import type { BoardSide } from './yugiohCard'

export interface Power {
  name: string
  description: string
  id: string
  used?: boolean
}

/** Card on the opponent's board that this player is pointing at (shared via Firestore). */
export type CardSelection = {
  location: keyof BoardSide
  index: number
} | null

export interface Crawl {
  code: number | null
  round: number
  duelId: string | null
  created: string | null
  modifiers: {
    drawCount: number
    rewards: number
    actionPoints: number
    totalDuels: number
  }
  player1: {
    id: string | null
    name: string | null
    deck: number[]
    powers: Power[]
    page: number
    wins: number
    selectedOpponentCard?: CardSelection
    actionPoints: number
  }
  player2: {
    id: string | null
    name: string | null
    deck: number[]
    powers: Power[]
    page: number
    wins: number
    selectedOpponentCard?: CardSelection
    actionPoints: number
  }
}
