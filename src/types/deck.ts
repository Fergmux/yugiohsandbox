import type { BanlistFormat } from './yugiohCard'

export type DeckType = 'starter' | 'reward' | null

export interface Deck {
  id: string
  name: string
  cards: number[]
  locked: boolean
  format: BanlistFormat
  type: DeckType
}
