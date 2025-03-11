export interface User {
  id: string
  username: string
}

export interface CardImage {
  image_url: string
}

export interface YugiohCard {
  id: number
  name: string
  desc: string
  type: string
  card_images: CardImage[]
  faceDown?: boolean
  defence?: boolean
}

export interface Deck {
  id: string
  name: string
  cards: number[]
}

export interface BoardSide {
  deck: YugiohCard[]
  hand: YugiohCard[]
  field: (YugiohCard | null)[]
  graveyard: YugiohCard[]
  banished: YugiohCard[]
  extra: YugiohCard[]
  zones: (YugiohCard | null)[]
}

export interface ExtraZone {
  card: YugiohCard | null
  owner: User | null
}

export interface GameState {
  code: number | null
  player1: User | null
  player2: User | null
  deck1: string | null
  deck2: string | null
  cards1: BoardSide
  cards2: BoardSide
}
