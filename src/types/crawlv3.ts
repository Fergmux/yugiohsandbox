export type Crawlv3Player = 'player1' | 'player2'
export type Crawlv3SpectatorPerspective = Crawlv3Player | 'both'

export type Crawlv3Zone = 'table' | 'hand' | 'deck' | 'extraDeck' | 'discard' | 'exhausted'
export type Crawlv3StatusType = 'buff' | 'debuff'

export interface Crawlv3CatalogHeaders {
  id: string
  title: string
  cost: string
  atk: string
  def: string
  category: string
  race: string
  damageType: string
  img: string
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
  fieldImageUrl: string
  statusCsvUrl: string
  statusHeaders: Crawlv3StatusHeaders
  extraDeckCategoriesText: string
  faceDownCategoriesText: string
  defaultLifePoints: number
  defaultActionPoints: number
}

export interface Crawlv3CatalogCard {
  id: string
  title: string
  cost: string
  atk: string
  def: string
  category: string
  race: string
  damageType: string
  img: string
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

export interface Crawlv3SpectatorInfo {
  uid: string
  username: string
  joinedAt: number
  spectatorPerspective: Crawlv3SpectatorPerspective
}

export interface Crawlv3DeckSelection {
  cards: Crawlv3CatalogCard[]
  ready: boolean
  updatedAt: number
}

export interface Crawlv3LobbyViewState {
  draftMode: 'catalog' | 'categories' | 'choices'
  draftCategory: string
  draftChoiceIds: string[]
}

export interface Crawlv3LobbyCardSelection {
  cardId: string | null
  visibleTo: Crawlv3Player[]
}

export interface Crawlv3CardSelection {
  instanceId: string | null
  visibleTo: Crawlv3Player[]
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
  category: string
  race: string
  damageType: string
  img: string
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
  spectators: Crawlv3SpectatorInfo[]
  deckSelections: {
    player1: Crawlv3DeckSelection | null
    player2: Crawlv3DeckSelection | null
  }
  lobbyStates: Record<Crawlv3Player, Crawlv3LobbyViewState>
  lobbyCardSelections: Record<string, Crawlv3LobbyCardSelection>
  cardSelections: Record<string, Crawlv3CardSelection>
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
      type: 'update_lobby_state'
      state: Crawlv3LobbyViewState
      actionId: string
    }
  | {
      type: 'select_lobby_card'
      cardId: string | null
      visibleTo: Crawlv3Player[]
      actionId: string
    }
  | {
      type: 'select_card'
      instanceId: string | null
      visibleTo: Crawlv3Player[]
      actionId: string
    }
  | {
      type: 'update_spectator_perspective'
      perspective: Crawlv3SpectatorPerspective
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
      patch: Partial<
        Pick<Crawlv3CardState, 'faceUp' | 'rotated' | 'atk' | 'def' | 'race' | 'damageType' | 'buffs' | 'debuffs'>
      >
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
