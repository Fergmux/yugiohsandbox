import type { GameState } from './crawlv2.js'

export type Player = 'player1' | 'player2'

export interface PlayerInfo {
  uid: string
  username: string
}

export interface DeckSelection {
  cardIds: number[]
  ready: boolean
}

export interface PendingReaction {
  id: string
  type: 'trap_activation' | 'effect_activation'
  respondingPlayer: Player
  triggerAction: GameAction
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
  | { type: 'summon_unit'; cardGameId: string; zoneId: string; actionId: string }
  | { type: 'set_trap'; cardGameId: string; zoneId: string; trapTriggers?: string[]; actionId: string }
  | { type: 'set_power'; cardGameId: string; zoneId: string; actionId: string }
  | { type: 'attack'; sourceGameId: string; targetGameId: string; actionId: string }
  | {
      type: 'activate_effect'
      cardGameId: string
      effectIndex: number
      targets?: string[]
      actionId: string
    }
  | { type: 'sacrifice'; cardGameId: string; actionId: string }
  | { type: 'swap_stance'; cardGameId: string; actionId: string }
  | { type: 'end_turn'; actionId: string }
  | {
      type: 'react'
      reactionId: string
      activate: boolean
      cardGameId?: string
      trapEffectType?: string
      targets?: string[]
      actionId: string
    }
