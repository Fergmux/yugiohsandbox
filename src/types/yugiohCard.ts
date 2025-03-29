import type { User } from './user'

export interface CardImage {
  image_url: string
}

export interface BanlistInfo {
  ban_goat: string
  ban_ocg: string
  ban_tcg: string
}

export interface MiscInfoDates {
  ocg_date: string
  tcg_date: string
}

interface MiscInfo extends MiscInfoDates {
  formats: string[]
}

export interface YugiohCardStrings {
  uid: string
  name: string
  desc: string
  type: string
  race: string
  attribute?: string
  frameType: string
  ocg_date: string
  tcg_date: string
  archetype?: string
  attached?: string
}

export interface YugiohCardNumbers {
  level?: number
  atk?: number
  def?: number
}

export interface YugiohCard extends YugiohCardStrings, YugiohCardNumbers {
  id: number
  banlist_info?: BanlistInfo
  misc_info: MiscInfo[]
  card_images: CardImage[]
  faceDown?: boolean
  defence?: boolean
  counters?: number
  revealed?: boolean
  newAttack?: number | null
  newDefence?: number | null
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
  gameLog: {
    text: string
    timestamp: number
  }[]
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
