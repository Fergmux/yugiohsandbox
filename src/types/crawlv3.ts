export type Crawlv3Player = 'player1' | 'player2'

export type Crawlv3Zone = 'table' | 'hand' | 'deck' | 'discard'
export type Crawlv3StatusType = 'buff' | 'debuff'

export interface Crawlv3CatalogHeaders {
  id: string
  title: string
  cost: string
  atk: string
  def: string
  race: string
  damageType: string
  description: string
}

export interface Crawlv3StatusHeaders {
  id: string
  name: string
  type: string
  description: string
}

export interface Crawlv3CatalogConfig {
  csvUrl: string
  headers: Crawlv3CatalogHeaders
  imageUrlTemplate: string
  imageOverridesText: string
  statusCsvUrl: string
  statusHeaders: Crawlv3StatusHeaders
  defaultLifePoints: number
  defaultActionPoints: number
}

export interface Crawlv3CatalogCard {
  id: string
  title: string
  cost: string
  atk: string
  def: string
  race: string
  damageType: string
  description: string
  imageUrl: string
}

export interface Crawlv3StatusDefinition {
  id: string
  name: string
  type: Crawlv3StatusType
  description: string
}

export interface Crawlv3PlayerInfo {
  uid: string
  username: string
  lifePoints: number
  actionPoints: number
}

export interface Crawlv3DeckSelection {
  cards: Crawlv3CatalogCard[]
  ready: boolean
  updatedAt: number
}

export interface Crawlv3CardState {
  instanceId: string
  cardId: string
  owner: Crawlv3Player
  title: string
  cost: string
  baseAtk: string
  baseDef: string
  atk: string
  def: string
  race: string
  damageType: string
  description: string
  imageUrl: string
  zone: Crawlv3Zone
  x: number
  y: number
  z: number
  order: number
  faceUp: boolean
  rotated: boolean
  buffs: Record<string, number>
  debuffs: Record<string, number>
}

export interface Crawlv3Game {
  _version: number
  code: number | null
  status: 'lobby' | 'active'
  createdBy: string
  createdAt: number
  config: Crawlv3CatalogConfig
  players: {
    player1: Crawlv3PlayerInfo | null
    player2: Crawlv3PlayerInfo | null
  }
  deckSelections: {
    player1: Crawlv3DeckSelection | null
    player2: Crawlv3DeckSelection | null
  }
  cards: Record<string, Crawlv3CardState>
  processedActions: string[]
}

export type Crawlv3Action =
  | {
      type: 'update_config'
      config: Crawlv3CatalogConfig
      actionId: string
    }
  | {
      type: 'select_deck'
      cards: Crawlv3CatalogCard[]
      actionId: string
    }
  | {
      type: 'set_ready'
      ready: boolean
      actionId: string
    }
  | {
      type: 'move_card'
      instanceId: string
      zone: Crawlv3Zone
      x?: number
      y?: number
      faceUp?: boolean
      rotated?: boolean
      actionId: string
    }
  | {
      type: 'patch_card'
      instanceId: string
      patch: Partial<Pick<Crawlv3CardState, 'faceUp' | 'rotated' | 'atk' | 'def' | 'buffs' | 'debuffs'>>
      actionId: string
    }
  | {
      type: 'set_player_stats'
      player: Crawlv3Player
      lifePoints?: number
      actionPoints?: number
      actionId: string
    }
  | {
      type: 'shuffle_deck'
      orderedCardIds: string[]
      actionId: string
    }
  | {
      type: 'shuffle_discard_into_deck'
      orderedCardIds: string[]
      actionId: string
    }
  | {
      type: 'complete_game'
      actionId: string
    }
