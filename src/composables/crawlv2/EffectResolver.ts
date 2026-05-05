import type { EffectDef, GameCard } from '@/types/cards'
import type { Location } from '@/types/crawlv2'

import { getEffectiveUses } from './buffs/AngerSystem'
import { clearBuffsFromSource, registerBuffReevaluation } from './BuffSystem'
import { drawCardForPlayer, shuffleDeck, spendCard } from './CardMovement'
import { evaluateChecks, evaluateConditions, filterByTargets } from './CheckSystem'
import { cleanupEffects, effectHandlers, type HandlerUtils } from './EffectHandlers'
import { Event, EventBus } from './EventBus'
import { getGameState } from './GameState'

export type EffectResolverConfig = {
  selectCard: (card: GameCard | null) => void
  ask: (card: GameCard) => Promise<boolean>
  multiplayer?: boolean
}

// Module-level singleton registry
let resolverInstance: EffectResolver | null = null

export function registerEffectResolver(config: EffectResolverConfig): EffectResolver {
  resolverInstance = new EffectResolver(config)
  return resolverInstance
}

export function getEffectResolver(): EffectResolver | null {
  return resolverInstance
}

export function clearEffectResolver(): void {
  resolverInstance = null
}

function getCard(location: Location): GameCard | null {
  return getGameState().cards.find((c) => c.location.id === location.id) ?? null
}

export class EffectResolver {
  private config: EffectResolverConfig
  private handlerUtils: HandlerUtils

  constructor(config: EffectResolverConfig) {
    this.config = config
    this.handlerUtils = {
      getCard,
      deductAP: (card) => this.deductAP(card),
      addAP: (card) => {
        const gs = getGameState()
        if (card.owner === 'player1') gs.player1AP += 1
        else if (card.owner === 'player2') gs.player2AP += 1
      },
      registerEffects: (card) => this.registerEffects(card),
      registerOngoingEffects: (card) => this.registerOngoingEffects(card),
      selectCard: config.selectCard,
    }
    this.setupGlobalListeners()
  }

  private setupGlobalListeners() {
    EventBus.on(Event.DAMAGE_DEALT, 'game', (_e, _id, data) => {
      const { player, amount } = data as { player: 'player1' | 'player2'; amount: number }
      const gs = getGameState()
      if (player === 'player1') {
        gs.player1HP = Math.max(0, gs.player1HP - amount)
      } else {
        gs.player2HP = Math.max(0, gs.player2HP - amount)
      }
    })

    if (this.config.multiplayer) return

    EventBus.on(Event.GAME_START, 'game:init', async (_e, _id, _data) => {
      shuffleDeck('player1')
      shuffleDeck('player2')
    })

    EventBus.on(Event.TURN_START, 'game:ap', async (_e, _id, data) => {
      const { currentPlayer } = data as { currentPlayer: 'player1' | 'player2' }
      const gs = getGameState()

      // Grant AP
      if (currentPlayer === 'player1') gs.player1AP = 2
      else gs.player2AP = 2

      // Snapshot retained hand cards before any async spending
      const handCards = gs.cards.filter((c) => c.location.type === 'hand' && c.owner === currentPlayer)
      const retainedIds = new Set(
        handCards.filter((c) => typeof c.buffs.retain === 'number' && c.buffs.retain > 0).map((c) => c.gameId),
      )

      // Spend non-retained hand cards
      for (const card of handCards) {
        if (retainedIds.has(card.gameId)) continue
        await spendCard(card)
      }

      // Draw 4 cards
      for (let i = 0; i < 4; i++) {
        await drawCardForPlayer(currentPlayer)
      }

      // Consume retain buff after spending and drawing are complete
      for (const card of gs.cards.filter((c) => retainedIds.has(c.gameId))) {
        if (typeof card.buffs.retain === 'number') {
          card.buffs.retain -= 1
          if (card.buffs.retain <= 0) delete card.buffs.retain
        }
      }
    })
  }

  private deductAP(card: GameCard) {
    const gs = getGameState()
    if (card.owner === 'player1') gs.player1AP -= card.cost
    else if (card.owner === 'player2') gs.player2AP -= card.cost
  }

  private chargeHandActivationAP(card: GameCard, effect: EffectDef): boolean {
    if (!effect.spentOnUse || card.location.type !== 'hand' || !card.owner) return true
    const gs = getGameState()
    const currentAP = card.owner === 'player1' ? gs.player1AP : gs.player2AP
    if (currentAP < card.cost) return false
    this.deductAP(card)
    return true
  }

  private async effectEnded(card: GameCard, effect: EffectDef, resolved = true) {
    if (effect.spentOnUse) {
      await spendCard(card)
    }
    if (effect.uses !== undefined && resolved) {
      effect.activations = (effect.activations ?? 0) + 1
    }
  }

  // ─── Effect Registration ─────────────────────────────────────────────────────

  registerEffects(card: GameCard) {
    for (const [effectIndex, effect] of (card.effects ?? []).entries()) {
      if (effect.trigger === 'manual') continue

      const handler = effectHandlers[effect.effect]
      if (!handler) continue

      console.log(
        `[registerEffects] registering ${effect.effect} on ${effect.trigger} for ${card.name} (${card.gameId})`,
      )
      EventBus.on(effect.trigger as Event, card.gameId, async (_e, _sourceId, data, ctx) => {
        const { skipEffectIndexes } = data as { skipEffectIndexes?: number[] }
        if (
          this.config.multiplayer &&
          effect.trigger === Event.UNIT_SUMMONED &&
          skipEffectIndexes?.includes(effectIndex)
        ) {
          return
        }

        if (effect.uses !== undefined && (effect.activations ?? 0) >= effect.uses) return

        // Evaluate trigger card conditions against the card that caused the event.
        // When no trigger card exists in data (e.g. TURN_START), use the source card
        // so comparators that don't need a candidate (like current_player) still work.
        if (effect.triggerConditions?.length) {
          const { card: triggerCard } = data as { card?: GameCard }
          if (!evaluateChecks(effect.triggerConditions, card, triggerCard ?? card)) return
        }

        const {
          target,
          source,
          effect: triggerEffect,
        } = data as { target?: GameCard; source?: GameCard; effect?: EffectDef }
        if (!evaluateConditions(effect.conditions, card, target, source, triggerEffect)) return

        if (effect.optional) {
          if (effect.targets?.length) {
            const validTargets = filterByTargets(effect.targets, card)
            if (validTargets.length === 0) return
            if (effect.selectCount !== undefined && validTargets.length < effect.selectCount) return
            if (effect.matchSelection?.length && (effect.selectCount ?? 0) >= 2) {
              const hasPair = validTargets.some((t1) =>
                validTargets.some((t2) => t2.gameId !== t1.gameId && evaluateChecks(effect.matchSelection!, t1, t2)),
              )
              if (!hasPair) return
            }
          }
          const activate = await this.config.ask(card)
          if (!activate) return
        }

        if (effect.eventName) {
          const { cancelled } = await EventBus.emit(effect.eventName, card.gameId, { card, target, effect })
          if (cancelled) {
            await this.effectEnded(card, effect, false)
            return
          }
        }

        // Resolve auto-target from event data, bypassing target selection prompt
        let handlerEffect = effect
        if (effect.autoTarget) {
          const autoCard = effect.autoTarget === 'event_source' ? source : target
          if (autoCard) {
            handlerEffect = {
              ...effect,
              targets: [[{ comparitor: 'equals', key: 'gameId', value: autoCard.gameId }]],
              optional: false,
              selectCount: undefined,
            }
          }
        }

        await handler(ctx, card, handlerEffect, this.handlerUtils)

        await this.effectEnded(card, effect, ctx.resolved)

        // Run chained follow-up effect if the parent resolved
        if (effect.then && ctx.resolved) {
          await this.activateEffect(card, effect.then)
        }

        // Run independent sibling effects (each can be individually negated)
        if (effect.and?.length) {
          for (const sibling of effect.and) {
            await this.activateEffect(card, sibling)
          }
        }
      })
    }

    if (card.location.type === 'unit') {
      this.registerOngoingEffects(card)
    }

    // Register reset listeners for effects with uses
    for (const effect of card.effects ?? []) {
      if (effect.resetOnEvent) {
        const resetKey = `reset:${card.gameId}:${effect.effect}`
        EventBus.on(effect.resetOnEvent, resetKey, () => {
          effect.activations = 0
        })
      }
    }

    // Auto-cleanup when card leaves the field
    if ((card.effects ?? []).length) {
      const cleanupKey = `cleanup:${card.gameId}`
      EventBus.on(Event.CARD_LEFT_FIELD, cleanupKey, (_e, _id, data) => {
        const { card: leftCard } = data as { card: GameCard }
        if (leftCard.gameId === card.gameId) {
          EventBus.off(Event.CARD_LEFT_FIELD, cleanupKey)
          cleanupEffects(card)
        }
      })
    }
  }

  // ─── Manual Effect Activation ────────────────────────────────────────────────

  async activateEffect(card: GameCard, effect: EffectDef | undefined) {
    if (!effect) return
    const maxUses = getEffectiveUses(card, effect)
    if (maxUses !== undefined && (effect.activations ?? 0) >= maxUses) return

    const handler = effectHandlers[effect.effect]
    if (!handler) return
    if (!this.chargeHandActivationAP(card, effect)) return

    if (effect.eventName) {
      const { cancelled } = await EventBus.emit(effect.eventName, card.gameId, { card, effect })
      if (cancelled) {
        await this.effectEnded(card, effect, false)
        return
      }
    }

    const ctx = {
      cancelled: false,
      resolved: true,
      cancel() {
        this.cancelled = true
      },
    }
    await handler(ctx, card, effect, this.handlerUtils)

    await this.effectEnded(card, effect, ctx.resolved)

    // Run chained follow-up effect if the parent resolved
    if (effect.then && ctx.resolved && !ctx.cancelled) {
      await this.activateEffect(card, effect.then)
    }

    // Run independent sibling effects (each can be individually negated)
    if (effect.and?.length) {
      for (const sibling of effect.and) {
        await this.activateEffect(card, sibling)
      }
    }

    await EventBus.emit(Event.UPDATED, card.gameId, { card })
  }

  // ─── Ongoing Effect Reapplication ───────────────────────────────────────────

  private async reapplyOngoingEffects(card: GameCard) {
    for (const effect of card.effects ?? []) {
      if (effect.trigger === 'manual' || !effect.ongoing) continue
      if (!evaluateConditions(effect.conditions, card)) continue

      const handler = effectHandlers[effect.effect]
      if (!handler) continue

      const ctx = {
        cancelled: false,
        resolved: false,
        cancel() {
          this.cancelled = true
        },
      }
      await handler(ctx, card, effect, this.handlerUtils)
    }
  }

  private registerOngoingEffects(card: GameCard) {
    if (!(card.effects ?? []).some((e) => e.ongoing)) return

    const reapply = () => {
      clearBuffsFromSource(card.gameId)
      if (card.location.type === 'unit') this.reapplyOngoingEffects(card)
    }

    registerBuffReevaluation(
      card,
      reapply,
      () => clearBuffsFromSource(card.gameId),
    )

    reapply()
  }
}

export function createEffectResolver(config: EffectResolverConfig): EffectResolver {
  return new EffectResolver(config)
}
