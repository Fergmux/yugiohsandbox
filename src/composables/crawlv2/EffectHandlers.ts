import type { GameCard, EffectDef, Check } from '@/types/cards'
import type { EventContext } from './EventBus'
import { Event, EventBus } from './EventBus'
import { filterByTargets, filterByChecks } from './CheckSystem'
import { useTargetSelector } from './useTargetSelector'
import { getEffective } from './BuffSystem'
import { spendCard, returnToHand, relocateCard, moveToDead, moveToDeck } from './CardMovement'
import { locations, fieldZones, type Location, type ZoneType } from '@/types/crawlv2'
import { validate } from 'uuid'

export type HandlerUtils = {
  getCard: (location: Location) => GameCard | null
  deductAP: (card: GameCard) => void
  addAP: (card: GameCard) => void
  registerEffects: (card: GameCard) => void
  registerOngoingEffects: (card: GameCard) => void
  selectCard: (card: GameCard | null) => void
}

export type TriggerHandler = (
  ctx: EventContext,
  card: GameCard,
  effect: EffectDef,
  utils: HandlerUtils,
) => void | Promise<void>

const buffEventMap: Record<string, Event> = {
  cleanse: Event.CLEANSE_APPLIED,
  empower: Event.EMPOWER_APPLIED,
  evasive: Event.evasive_APPLIED,
  eternal: Event.ETERNAL_APPLIED,
  piercing: Event.PIERCING_APPLIED,
  burn: Event.BURN_APPLIED,
  shield: Event.SHIELD_APPLIED,
  anger: Event.ANGER_APPLIED,
  intangible: Event.INTANGIBLE_APPLIED,
  damage_type: Event.DAMAGE_TYPE_APPLIED,
  weak: Event.WEAK_APPLIED,
  cursed: Event.CURSED_APPLIED,
  blind: Event.BLIND_APPLIED,
}

function getOpponent(card: GameCard) {
  return card.owner === 'player1' ? 'player2' : 'player1'
}

const { selectTargets, selectZone, selectCards } = useTargetSelector()

async function destroyUnit(unit: GameCard, source: GameCard) {
  const { cancelled } = await EventBus.emit(Event.UNIT_DEFEATED, unit.gameId, { target: unit, source })
  if (cancelled) return
  await spendCard(unit)
  await EventBus.emit(Event.UNIT_SPENT, unit.gameId, { target: unit, source })
}

async function applyDamage(gameId: string, player: string | undefined, amount: number) {
  if (amount <= 0) return
  const { cancelled } = await EventBus.emit(Event.DAMAGE_ATTEMPTED, gameId, {
    player,
    amount,
  })
  if (!cancelled) {
    await EventBus.emit(Event.DAMAGE_DEALT, gameId, { player, amount })
  }
}

export async function resolveCombat(source: GameCard, target: GameCard) {
  const srcAtk = getEffective(source).atk ?? 0
  if (!srcAtk) return

  if (target.defensePosition) {
    const tgtDef = getEffective(target).def ?? 0
    if (srcAtk >= tgtDef) {
      await destroyUnit(target, source)
      if (source.buffs.piercing) {
        const piercingDmg = srcAtk - tgtDef
        await applyDamage(target.gameId, target.owner, piercingDmg)
      }
    } else {
      const reflectDmg = tgtDef - srcAtk
      await applyDamage(source.gameId, source.owner, reflectDmg)
    }
  } else {
    const tgtAtk = getEffective(target).atk ?? 0
    if (srcAtk > tgtAtk) {
      await destroyUnit(target, source)
      const dmg = srcAtk - tgtAtk
      await applyDamage(target.gameId, target.owner, dmg)
    } else if (srcAtk < tgtAtk) {
      await destroyUnit(source, target)
      const dmg = tgtAtk - srcAtk
      await applyDamage(source.gameId, source.owner, dmg)
    } else {
      await destroyUnit(target, source)
      await destroyUnit(source, target)
    }
  }
}

export const effectHandlers: Record<string, TriggerHandler> = {
  negate_attack: async (ctx) => {
    ctx.cancel()
  },

  negate_spend: async (ctx) => {
    ctx.cancel()
  },

  negate_effect: async (ctx) => {
    ctx.cancel()
  },

  debuff: async (ctx, card, effect) => {
    if (!effect.targets?.length) {
      ctx.resolved = false
      return
    }

    const validTargets = filterByTargets(effect.targets, card)
    if (!validTargets.length) {
      ctx.resolved = false
      return
    }

    const selected = await selectTargets(validTargets, effect)
    if (!selected.length) {
      ctx.resolved = false
      return
    }

    if (Array.isArray(effect.options?.debuffs)) {
      for (const { key, count, countChecks } of effect.options.debuffs as {
        key?: string
        count?: number
        countChecks?: Check[][]
      }[]) {
        const value = countChecks ? filterByChecks(countChecks, card).length : count
        if (!key || !value) continue
        for (const target of selected) {
          const { cancelled } = await EventBus.emit(Event.DEBUFF_ATTEMPTED, target.gameId, { card, target })
          if (cancelled) continue
          const current = target.debuffs[key] || 0
          if (typeof current !== 'number' || typeof value !== 'number') continue
          target.debuffs[key] = current + value
          const appliedEvent = buffEventMap[key]
          if (appliedEvent) await EventBus.emit(appliedEvent, target.gameId, { card: target, source: card })
        }
      }
    }
  },

  buff: async (ctx, card, effect) => {
    if (!effect.targets?.length) {
      ctx.resolved = false
      return
    }

    const validTargets = filterByTargets(effect.targets, card)
    if (!validTargets.length) {
      ctx.resolved = false
      return
    }

    const targets = await selectTargets(validTargets, effect)
    if (!targets.length) {
      ctx.resolved = false
      return
    }

    if (Array.isArray(effect.options?.buffs)) {
      for (const { key, count, countChecks } of effect.options.buffs as {
        key?: string
        count?: number
        countChecks?: Check[][]
      }[]) {
        const value = countChecks ? filterByChecks(countChecks, card).length : count
        if (!key || !value) continue

        for (const target of targets) {
          const { cancelled } = await EventBus.emit(Event.BUFF_ATTEMPTED, target.gameId, { card, target })
          if (cancelled) continue
          const current = target.buffs[key] || 0
          if (typeof current !== 'number' || typeof value !== 'number') continue

          target.buffs[key] = current + value

          const appliedEvent = buffEventMap[key]
          if (appliedEvent) await EventBus.emit(appliedEvent, target.gameId, { card: target, source: card })
        }
      }
    }
  },

  move_card: async (ctx, card, effect, utils) => {
    if (!effect.targets?.length) {
      ctx.resolved = false
      return
    }
    const targets = filterByTargets(effect.targets, card)
    if (!targets.length) {
      ctx.resolved = false
      return
    }

    const moveData = effect.options as { destination: ZoneType; count?: number } | null
    const destination: ZoneType = moveData?.destination ?? 'hand'
    const count = moveData?.count ?? 1

    let cardsToMove = targets

    if (targets.every((t) => fieldZones.includes(t.location.type))) {
      cardsToMove = await selectTargets(targets, effect)
    } else if (count < targets.length) {
      cardsToMove = await selectCards(targets, count, `Select cards to move to ${destination}`)
      if (!cardsToMove.length) return
    }

    for (const target of cardsToMove) {
      if ((fieldZones as string[]).includes(destination)) {
        const validZones = locations.filter(
          (loc) => loc.type === destination && loc.player === target.owner && !utils.getCard(loc),
        )
        const zone = await selectZone(validZones, target.name)
        if (!zone) continue
        await relocateCard(target, zone)
      } else if (destination === 'hand') {
        await returnToHand(target)
      } else if (destination === 'spent') {
        await spendCard(target)
      } else if (destination === 'dead') {
        await moveToDead(target)
      } else if (destination === 'deck') {
        await moveToDeck(target)
      } else if (destination === 'leader') {
        const leaderZone = locations.find((loc) => loc.type === 'leader' && loc.player === target.owner)
        if (leaderZone) await relocateCard(target, leaderZone)
      }
      await EventBus.emit(Event.CARD_MOVED, target.gameId, { card: target, source: card, destination })
    }
  },

  direct_damage: async (_ctx, card, effect) => {
    const amount = (effect.options?.amount as number) ?? 0
    if (!amount) return
    const target = effect.options?.target as string | undefined
    const player = target === 'opponent' ? getOpponent(card) : card.owner
    await applyDamage(card.gameId, player, amount)
  },

  damage_type: (_ctx, card, effect) => {
    if (!effect.targets?.length) return
    const targets = filterByTargets(effect.targets, card)
    for (const t of targets) {
      t.buffs['damage'] = (effect.options?.damageType as string) ?? ''
    }
  },

  summon: async (_ctx, card, _effect, utils) => {
    const zoneType = card.type === 'unit' ? 'unit' : card.type === 'power' ? 'power' : null
    if (!zoneType) return
    const validZones = locations.filter(
      (loc) => loc.type === zoneType && loc.player === card.owner && !utils.getCard(loc),
    )
    const zone = await selectZone(validZones, card.name)
    if (!zone) return

    if (zoneType === 'unit') {
      const { cancelled } = await EventBus.emit(Event.UNIT_PLAYED, card.gameId, { card })
      if (cancelled) return
      utils.deductAP(card)
      utils.registerEffects(card)
      await relocateCard(card, zone)
      utils.registerOngoingEffects(card)
      await EventBus.emit(Event.UNIT_SUMMONED, card.gameId, { card })
    } else {
      const { cancelled } = await EventBus.emit(Event.POWER_PLAYED, card.gameId, { card })
      if (cancelled) return
      utils.deductAP(card)
      utils.registerEffects(card)
      await relocateCard(card, zone)
      await EventBus.emit(Event.POWER_SET, card.gameId, { card })
    }

    utils.selectCard(null)
  },

  set_trap: async (_ctx, card, _effect, utils) => {
    const validZones = locations.filter(
      (loc) => loc.type === 'trap' && loc.player === card.owner && !utils.getCard(loc),
    )
    const zone = await selectZone(validZones, card.name)
    if (!zone) return
    const { cancelled } = await EventBus.emit(Event.TRAP_PLAYED, card.gameId, { card })
    if (cancelled) return
    utils.deductAP(card)
    utils.registerEffects(card)
    await relocateCard(card, zone)
    card.faceUp = false
    await EventBus.emit(Event.TRAP_SET, card.gameId, { card })
    utils.selectCard(null)
  },

  sacrifice: async (_ctx, card, _effect, utils) => {
    const { cancelled } = await EventBus.emit(Event.SACRIFICE_ATTEMPTED, card.gameId, { card })
    if (cancelled) return
    utils.addAP(card)
    utils.selectCard(null)
    await spendCard(card)
    await EventBus.emit(Event.SACRIFICE_SUCCESSFUL, card.gameId, { card })
  },

  swap_stance: async (_ctx, card, effect) => {
    if (!effect.targets?.length) return

    const targets = filterByTargets(effect.targets, card)

    for (const target of targets) {
      const { cancelled } = await EventBus.emit(Event.STANCE_SWAP_ATTEMPTED, target.gameId, {
        card: target,
        source: card,
      })
      if (cancelled) continue
      target.defensePosition = !target.defensePosition
      await EventBus.emit(Event.STANCE_SWAP_SUCCESSFUL, target.gameId, { card: target, source: card })
    }
  },

  flip_card: async (ctx, card, effect, utils) => {
    if (!effect.targets?.length) {
      ctx.resolved = false
      return
    }
    const validTargets = filterByTargets(effect.targets, card)
    if (!validTargets.length) {
      ctx.resolved = false
      return
    }
    // select a target
    const targets = await selectTargets(validTargets, effect)
    if (!targets.length) {
      ctx.resolved = false
      return
    }

    for (const target of targets) {
      const { cancelled } = await EventBus.emit(Event.CARD_FLIPPED, target.gameId, { card: target, source: card })
      if (cancelled) continue
      target.faceUp = !target.faceUp
    }
    utils.selectCard(null)
  },

  damage: async (_ctx, card, effect) => {
    if (!effect.targets?.length) return

    const validTargets = filterByTargets(effect.targets, card).filter(
      (t) => !(typeof t.buffs.evasive === 'number' && t.buffs.evasive > 0),
    )

    // If there are no opponent units at all, attack life points directly
    const opponentUnits = filterByChecks(
      [
        [
          { comparitor: 'equals', key: 'location.type', value: 'unit' },
          { comparitor: 'owner', value: 'opponent' },
        ],
      ],
      card,
    )
    if (!opponentUnits.length) {
      const { cancelled } = await EventBus.emit(Event.DAMAGE_ATTEMPTED, card.gameId, {
        player: getOpponent(card),
        amount: getEffective(card).atk ?? 0,
      })
      if (!cancelled)
        await EventBus.emit(Event.DAMAGE_DEALT, card.gameId, {
          player: getOpponent(card),
          amount: getEffective(card).atk ?? 0,
        })
      return
    }
    if (!validTargets.length) return

    let targets
    if (card.debuffs.blind !== undefined && (card.debuffs.blind as number) > 0) {
      targets = [validTargets[Math.floor(Math.random() * validTargets.length)]]
    } else {
      targets = await selectTargets(validTargets, effect)
    }

    if (!targets.length) return

    targets.forEach(async (target) => {
      const { cancelled } = await EventBus.emit(Event.ATTACK_DECLARED, target.gameId, { target, source: card })
      if (cancelled) return
      await EventBus.emit(Event.ATTACK_SUCCESSFUL, target.gameId, { target, source: card })
      await resolveCombat(card, target)
    })
  },
}

/**
 * Cleans up all effect listeners registered for a specific card.
 * Call this when a card leaves the field to prevent stale listeners.
 */
export const cleanupEffects = (card: GameCard) => {
  for (const effect of card.effects ?? []) {
    if (effect.trigger) {
      EventBus.off(effect.trigger as Event, card.gameId)
    }
    if (effect.resetOnEvent) {
      EventBus.off(effect.resetOnEvent, `reset:${card.gameId}:${effect.effect}`)
    }
  }
}
