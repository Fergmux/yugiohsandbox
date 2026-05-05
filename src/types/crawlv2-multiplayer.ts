import type { GameState, Location } from './crawlv2.js'

export type Player = 'player1' | 'player2'

export interface PlayerInfo {
  uid: string
  username: string
}

export interface DeckSelection {
  cardIds: number[]
  ready: boolean
}

export interface TrapReactionRule {
  trigger: string
  requiresUndefinedSelectCount?: boolean
}

export interface SerializedEffectAction {
  effectType: string
  effectOptions?: Record<string, unknown>
  targets?: string[]
}

export interface SerializedSummonEffect {
  effectIndex: number
  effectType: string
  effectOptions?: Record<string, unknown>
}

export interface PendingReaction {
  id: string
  type: 'trap_activation' | 'effect_activation'
  respondingPlayer: Player
  triggerAction: GameAction
  triggerEvent?: string
  eventSourceGameId?: string
  eventTargetGameId?: string
  eligibleCards: string[]
  timeout: number
}

export interface CrawlV2Game {
  _version: number
  code: number | null
  status: 'lobby' | 'active' | 'finished'
  winner?: Player | null

  players: {
    player1: PlayerInfo | null
    player2: PlayerInfo | null
  }

  decks: {
    player1: DeckSelection | null
    player2: DeckSelection | null
  }

  gameState: GameState

  pendingReaction: PendingReaction | null

  processedActions: string[]
}

export type GameAction =
  | { type: 'select_deck'; cardIds: number[]; actionId: string }
  | { type: 'ready_up'; actionId: string }
  | {
      type: 'summon_unit'
      cardGameId: string
      zoneId: string
      summonEffects?: SerializedSummonEffect[]
      actionId: string
    }
  | {
      type: 'set_trap'
      cardGameId: string
      zoneId: string
      trapTriggers?: string[]
      trapReactionRules?: TrapReactionRule[]
      actionId: string
    }
  | { type: 'set_power'; cardGameId: string; zoneId: string; actionId: string }
  | { type: 'attack'; sourceGameId: string; targetGameId: string; effectIndex?: number; actionId: string }
  | {
      type: 'activate_effect'
      cardGameId: string
      effectIndex: number
      targets?: string[]
      selectCount?: number
      effectType?: string
      effectOptions?: Record<string, unknown>
      thenEffect?: SerializedEffectAction
      andEffects?: SerializedEffectAction[]
      spentOnUse?: boolean
      maxUses?: number
      actionId: string
    }
  | { type: 'sacrifice'; cardGameId: string; actionId: string }
  | { type: 'swap_stance'; cardGameId: string; actionId: string }
  | { type: 'end_turn'; actionId: string }
  | {
      type: 'update_card_buffs'
      updates: {
        gameId: string
        buffs: Record<string, string | number>
        debuffs: Record<string, string | number>
        location?: Location
        faceUp?: boolean
        defensePosition?: boolean
      }[]
      player1HP?: number
      player2HP?: number
      player1AP?: number
      player2AP?: number
      actionId: string
    }
  | {
      type: 'react'
      reactionId: string
      activate: boolean
      cardGameId?: string
      trapEffectType?: string
      trapEffectOptions?: Record<string, unknown>
      trapTargets?: string[]
      trapThenEffect?: SerializedEffectAction
      trapAndEffects?: SerializedEffectAction[]
      targets?: string[]
      actionId: string
    }
