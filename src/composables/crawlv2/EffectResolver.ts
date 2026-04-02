import type { GameCard, EffectDef } from '@/types/cards'
import { Event, EventBus } from './EventBus'
import { getLocationId, type Location } from '@/types/crawlv2'
import { clearBuffsFromSource, registerBuffReevaluation } from './BuffSystem'
import { effectHandlers, cleanupEffects } from './EffectHandlers'
import { evaluateCondition } from './CheckSystem'
import { relocateCard } from './CardMovement'

export type GameState = {
  player1HP: number
  player2HP: number
}

export type EffectResolverConfig = {
  getCard: (location: Location) => GameCard | null
  selectCard: (card: GameCard | null) => void
  ask: (card: GameCard) => Promise<boolean>
  getCurrentPlayer: () => string
  gameState: GameState
}

export class EffectResolver {
  private config: EffectResolverConfig

  constructor(config: EffectResolverConfig) {
    this.config = config
    this.setupGlobalListeners()
  }

  private setupGlobalListeners() {
    EventBus.on(Event.PLAYER_DAMAGE, 'game', (_e, _id, data) => {
      const { player, amount } = data as { player: 'player1' | 'player2'; amount: number }
      if (player === 'player1') {
        this.config.gameState.player1HP = Math.max(0, this.config.gameState.player1HP - amount)
      } else {
        this.config.gameState.player2HP = Math.max(0, this.config.gameState.player2HP - amount)
      }
    })

    EventBus.on(Event.UNIT_STANCE_SWAP, 'game', (_e, _id, data) => {
      const { card } = data as { card?: GameCard }
      if (!card || card.type !== 'unit' || card.location.type !== 'unit') return
      card.defensePosition = !card.defensePosition
    })
  }

  // ─── Effect Registration ─────────────────────────────────────────────────────

  registerEffects(card: GameCard, cards: GameCard[]) {
    for (const effect of card.effects ?? []) {
      if (effect.trigger === 'manual') continue

      const handler = effectHandlers[effect.effect]
      if (!handler) continue

      EventBus.on(effect.trigger as Event, card.gameId, async (_e, _id, data, ctx) => {
        // Check uses limit
        if (effect.uses !== undefined && (effect.activations ?? 0) >= effect.uses) return

        // Only fire on the owner's turn if flagged
        if (effect.activateOnOwnerTurn) {
          const { currentPlayer } = data as { currentPlayer?: string }
          if (currentPlayer !== card.owner) return
        }

        if (effect.optional) {
          const activate = await this.config.ask(card)
          if (!activate) return
        }

        await handler(data, ctx, card, effect, cards)

        // Increment activations
        if (effect.uses !== undefined) {
          effect.activations = (effect.activations ?? 0) + 1
        }

        // Fire notification event AFTER handler (consistent ordering)
        if (effect.eventName) {
          const { cancelled } = await EventBus.emit(effect.eventName, card.gameId, { card })
          if (cancelled) return
        }

        if (!effect.persistent) {
          EventBus.off(effect.trigger as Event, card.gameId)
        }
      })
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

    // Auto-cleanup when card leaves the field (distinct key avoids collisions)
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

  async activateEffect(card: GameCard, cards: GameCard[]) {
    const manualEffects = card.effects?.filter(
      (e) => e.trigger === 'manual' && (e.uses === undefined || (e.activations ?? 0) < e.uses),
    )
    if (!manualEffects?.length) return

    for (const effect of manualEffects) {
      await this.activateManualEffect(card, effect, cards)
    }
  }

  private async activateManualEffect(card: GameCard, effect: EffectDef, cards: GameCard[]) {
    if (effect.trigger !== 'manual') return
    if (this.config.getCurrentPlayer() !== card.owner) return
    if (effect.uses !== undefined && (effect.activations ?? 0) >= effect.uses) return

    const handler = effectHandlers[effect.effect]
    if (!handler) return

    const ctx = {
      cancelled: false,
      cancel() {
        this.cancelled = true
      },
    }
    await handler({}, ctx, card, effect, cards)

    if (effect.uses !== undefined) {
      effect.activations = (effect.activations ?? 0) + 1
    }

    if (!effect.persistent) {
      const idx = card.effects?.indexOf(effect)
      if (idx !== undefined && idx > -1) card.effects?.splice(idx, 1)
    }

    // Fire notification event AFTER handler (consistent ordering)
    if (effect.eventName) {
      await EventBus.emit(effect.eventName, card.gameId, { card })
    }
  }

  // ─── Effect Execution (play-time and ongoing reapplication) ──────────────────

  private async executeCardEffects(card: GameCard, cards: GameCard[], trigger?: Event, onlyOngoing = false) {
    for (const effect of card.effects ?? []) {
      if (!onlyOngoing) {
        if (trigger !== undefined && effect.trigger !== trigger) continue
        if (trigger === undefined && effect.trigger !== undefined) continue
      }
      if (onlyOngoing && !effect.ongoing) continue
      if (effect.conditions?.some((c) => !evaluateCondition(c, card, cards))) continue

      const handler = effectHandlers[effect.effect]
      if (!handler) continue

      const ctx = {
        cancelled: false,
        cancel() {
          this.cancelled = true
        },
      }
      await handler({}, ctx, card, effect, cards)
    }
  }

  // ─── Game Actions ────────────────────────────────────────────────────────────

  async damage({ target, source }: { target: GameCard | null; source: GameCard | null }) {
    if (!target || !source) return

    const { cancelled } = await EventBus.emit(Event.TARGETED_ATTACK, target.gameId, { target, source })
    if (cancelled) return

    // Attack resolved (not negated) — post-attack effects like burn self-damage
    await EventBus.emit(Event.ATTACK_RESOLVED, target.gameId, { target, source })

    if (source.atk && target.def && target.atk) {
      if (target.def <= source.atk) {
        await EventBus.emit(Event.DAMAGE_DEALT, target.gameId, { target, source })
        await EventBus.emit(Event.UNIT_DEFEATED, target.gameId, { target, source })
        await relocateCard(target, {
          id: getLocationId('spent', 1, target.owner ?? null),
          type: 'spent',
          index: 1,
          player: target.owner ?? null,
          name: 'Spent',
        })
      }
    }
  }

  async setTrap(card: GameCard, location: Location) {
    const { cancelled } = await EventBus.emit(Event.TRAP_SET, card.gameId, { card })
    if (cancelled) return
    await relocateCard(card, location)
  }

  async swapStance({ card }: { card: GameCard | null }) {
    if (!card) return
    await EventBus.emit(Event.UNIT_STANCE_SWAP, card.gameId, { card })
  }

  private registerOngoingEffects(card: GameCard, cards: GameCard[]) {
    if (!(card.effects ?? []).some((e) => e.ongoing)) return

    registerBuffReevaluation(
      card,
      () => {
        clearBuffsFromSource(card.gameId, cards)
        if (card.location.type === 'unit') this.executeCardEffects(card, cards, undefined, true)
      },
      () => clearBuffsFromSource(card.gameId, cards),
    )
  }

  async summon(card: GameCard, cards: GameCard[], location: Location) {
    const { cancelled } = await EventBus.emit(Event.UNIT_SUMMONED, card.gameId, { card })
    if (cancelled) return
    await relocateCard(card, location)
    await this.executeCardEffects(card, cards, Event.UNIT_SUMMONED)
    this.registerOngoingEffects(card, cards)
  }

  async playCard(card: GameCard, location: Location, cards: GameCard[]) {
    let ctx
    switch (card.type) {
      case 'unit':
        ctx = await EventBus.emit(Event.UNIT_PLAYED, card.gameId, { card })
        if (ctx.cancelled) return
        this.registerEffects(card, cards)
        await this.summon(card, cards, location)
        break
      case 'effect':
        ctx = await EventBus.emit(Event.TARGETED_EFFECT, card.gameId, { card })
        if (ctx.cancelled) return
        await this.executeCardEffects(card, cards)
        break
      case 'trap':
        ctx = await EventBus.emit(Event.TRAP_PLAYED, card.gameId, { card })
        if (ctx.cancelled) return
        this.registerEffects(card, cards)
        await this.setTrap(card, location)
        break
      case 'power':
        ctx = await EventBus.emit(Event.POWER_PLAYED, card.gameId, { card })
        if (ctx.cancelled) return
        this.registerEffects(card, cards)
        await EventBus.emit(Event.POWER_SET, card.gameId, { card })
        break
    }

    this.config.selectCard(null)
  }

  async moveCard(selectedCard: GameCard, location: Location, cards: GameCard[]) {
    const cardAtLocation = this.config.getCard(location)

    if (['unit', 'power', 'trap'].includes(location.type) && !cardAtLocation) {
      await this.playCard(selectedCard, location, cards)
      return
    }

    if (
      cardAtLocation &&
      cardAtLocation.location.type === 'unit' &&
      selectedCard.location.type === 'unit' &&
      cardAtLocation.gameId !== selectedCard.gameId
    ) {
      await this.damage({ target: cardAtLocation, source: selectedCard })
      this.config.selectCard(null)
    } else if (!cardAtLocation) {
      await relocateCard(selectedCard, location)
    }
  }
}

export function createEffectResolver(config: EffectResolverConfig): EffectResolver {
  return new EffectResolver(config)
}
