import type { GameCard } from '@/types/cards'
import { Event, EventBus } from './EventBus'
import type { Location } from '@/types/crawlv2'
import { clearBuffsFromSource, registerBuffReevaluation } from './BuffSystem'
import { effectHandlers, cleanupEffects, type HandlerUtils } from './EffectHandlers'
import { evaluateConditions, evaluateChecks } from './CheckSystem'
import { spendCard, drawCardForPlayer, shuffleDeck } from './CardMovement'
import { getGameState } from './GameState'

export type EffectResolverConfig = {
  selectCard: (card: GameCard | null) => void
  ask: (card: GameCard) => Promise<boolean>
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
        if (card.owner === 'player1') gs.player1AP += card.cost
        else if (card.owner === 'player2') gs.player2AP += card.cost
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

      // Spend all hand cards
      const handCards = gs.cards.filter((c) => c.location.type === 'hand' && c.owner === currentPlayer)
      for (const card of handCards) {
        await spendCard(card)
      }

      // Draw 4 cards
      for (let i = 0; i < 4; i++) {
        await drawCardForPlayer(currentPlayer)
      }
    })
  }

  private deductAP(card: GameCard) {
    const gs = getGameState()
    if (card.owner === 'player1') gs.player1AP -= card.cost
    else if (card.owner === 'player2') gs.player2AP -= card.cost
  }

  // ─── Effect Registration ─────────────────────────────────────────────────────

  registerEffects(card: GameCard) {
    for (const effect of card.effects ?? []) {
      if (effect.trigger === 'manual') continue

      const handler = effectHandlers[effect.effect]
      if (!handler) continue

      EventBus.on(effect.trigger as Event, card.gameId, async (_e, _sourceId, data, ctx) => {
        if (effect.uses !== undefined && (effect.activations ?? 0) >= effect.uses) return

        // Evaluate trigger card conditions against the card that caused the event.
        // When no trigger card exists in data (e.g. TURN_START), use the source card
        // so comparators that don't need a candidate (like current_player) still work.
        if (effect.triggerCardConditions?.length) {
          const { card: triggerCard } = data as { card?: GameCard }
          if (!evaluateChecks(effect.triggerCardConditions, card, triggerCard ?? card)) return
        }

        const { target } = data as { target?: GameCard }

        if (!evaluateConditions(effect.conditions, card, target)) return

        if (effect.optional) {
          const activate = await this.config.ask(card)
          if (!activate) return
        }

        if (effect.eventName) {
          const { cancelled } = await EventBus.emit(effect.eventName, card.gameId, { card })
          if (cancelled) return
        }

        await handler(data, ctx, card, effect, this.handlerUtils)

        // Emit success event based on card type
        if (card.type === 'trap') {
          await EventBus.emit(Event.TRAP_SUCCESSFUL, card.gameId, { card })
        } else if (card.type === 'power') {
          await EventBus.emit(Event.POWER_SUCCESSFUL, card.gameId, { card })
        } else if (card.type === 'effect') {
          await EventBus.emit(Event.EFFECT_APPLIED, card.gameId, { card })
        }

        if (effect.uses !== undefined) {
          effect.activations = (effect.activations ?? 0) + 1
        }

        if (effect.spentOnUse) {
          await spendCard(card)
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

  async activateEffect(card: GameCard, effectIndex: number) {
    const effect = card.effects?.[effectIndex]
    if (!effect || effect.trigger !== 'manual') return
    if (getGameState().currentPlayer !== card.owner) return
    if (effect.uses !== undefined && (effect.activations ?? 0) >= effect.uses) return

    const handler = effectHandlers[effect.effect]
    if (!handler) return

    if (effect.eventName) {
      const { cancelled } = await EventBus.emit(effect.eventName, card.gameId, { card })
      if (cancelled) return
    }

    const ctx = {
      cancelled: false,
      cancel() {
        this.cancelled = true
      },
    }
    await handler({}, ctx, card, effect, this.handlerUtils)

    if (card.type === 'unit') {
      await EventBus.emit(Event.UNIT_ABILITY_SUCCESSFUL, card.gameId, { card })
    }

    if (effect.uses !== undefined) {
      effect.activations = (effect.activations ?? 0) + 1
    }

    if (!effect.persistent) {
      const idx = card.effects?.indexOf(effect)
      if (idx !== undefined && idx > -1) card.effects?.splice(idx, 1)
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
        cancel() {
          this.cancelled = true
        },
      }
      await handler({}, ctx, card, effect, this.handlerUtils)
    }
  }

  private registerOngoingEffects(card: GameCard) {
    if (!(card.effects ?? []).some((e) => e.ongoing)) return

    registerBuffReevaluation(
      card,
      () => {
        clearBuffsFromSource(card.gameId)
        if (card.location.type === 'unit') this.reapplyOngoingEffects(card)
      },
      () => clearBuffsFromSource(card.gameId),
    )
  }
}

export function createEffectResolver(config: EffectResolverConfig): EffectResolver {
  return new EffectResolver(config)
}
