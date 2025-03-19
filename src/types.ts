export interface User {
  id: string
  username: string
}

export interface CardImage {
  image_url: string
}

export interface YugiohCard {
  id: number
  uid: string
  name: string
  desc: string
  type: string
  atk: number
  def: number
  card_images: CardImage[]
  faceDown?: boolean
  defence?: boolean
  counters?: number
  revealed?: boolean
  attached?: string
  newAttack?: number
  newDefence?: number
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
  tokens: YugiohCard[]
  attached: YugiohCard[]
}

export interface ExtraZone {
  card: YugiohCard | null
  owner: User | null
}

export interface GameState {
  code: number | null
  coinFlip?: ['heads' | 'tails', number] | null
  turn: number
  players: {
    player1: User | null
    player2: User | null
  }
  decks: {
    player1: string | null
    player2: string | null
  }
  lifePoints: {
    player1: number
    player2: number
  }
  cards: {
    player1: BoardSide
    player2: BoardSide
  }
}
