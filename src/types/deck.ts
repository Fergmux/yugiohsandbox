import type { BanlistFormat } from './yugiohCard'

export interface Deck {
  id: string
  name: string
  cards: number[]
  locked: boolean
  format: BanlistFormat
}
