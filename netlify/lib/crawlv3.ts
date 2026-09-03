import { v4 as uuid } from 'uuid'

export const CRAWLV3_GAMES_COLLECTION = 'crawlv3_games'

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

export type Crawlv3ActionResult = { success: true } | { success: false; error: string }

export function createDefaultCrawlv3Config(): Crawlv3CatalogConfig {
  return {
    csvUrl: '',
    headers: {
      id: '',
      title: '',
      cost: '',
      atk: '',
      def: '',
      category: '',
      race: '',
      damageType: '',
      img: 'card_art',
      description: '',
    },
    imageUrlTemplate: '',
    imageOverridesText: '',
    fieldImageUrl:
      'https://eu-west-2.console.aws.amazon.com/s3/object/yugioh-simulator?region=eu-west-2&prefix=card_art/field.png',
    statusCsvUrl: '',
    statusHeaders: {
      id: 'id',
      name: 'name',
      type: 'type',
      description: 'description',
    },
    extraDeckCategoriesText: 'Fusion Unit, Ritual Unit',
    faceDownCategoriesText: 'Trap',
    defaultLifePoints: 8000,
    defaultActionPoints: 0,
  }
}

export function sanitizeCrawlv3Config(config: Partial<Crawlv3CatalogConfig> | undefined): Crawlv3CatalogConfig {
  const fallback = createDefaultCrawlv3Config()

  return {
    csvUrl: config?.csvUrl?.trim() ?? fallback.csvUrl,
    headers: {
      id: config?.headers?.id?.trim() ?? fallback.headers.id,
      title: config?.headers?.title?.trim() ?? fallback.headers.title,
      cost: config?.headers?.cost?.trim() ?? fallback.headers.cost,
      atk: config?.headers?.atk?.trim() ?? fallback.headers.atk,
      def: config?.headers?.def?.trim() ?? fallback.headers.def,
      category: config?.headers?.category?.trim() ?? fallback.headers.category,
      race: config?.headers?.race?.trim() ?? fallback.headers.race,
      damageType: config?.headers?.damageType?.trim() ?? fallback.headers.damageType,
      img: config?.headers?.img?.trim() ?? fallback.headers.img,
      description: config?.headers?.description?.trim() ?? fallback.headers.description,
    },
    imageUrlTemplate: config?.imageUrlTemplate?.trim() ?? fallback.imageUrlTemplate,
    imageOverridesText: config?.imageOverridesText ?? fallback.imageOverridesText,
    fieldImageUrl: config?.fieldImageUrl?.trim() ?? fallback.fieldImageUrl,
    statusCsvUrl: config?.statusCsvUrl?.trim() ?? fallback.statusCsvUrl,
    statusHeaders: {
      id: config?.statusHeaders?.id?.trim() ?? fallback.statusHeaders.id,
      name: config?.statusHeaders?.name?.trim() ?? fallback.statusHeaders.name,
      type: config?.statusHeaders?.type?.trim() ?? fallback.statusHeaders.type,
      description: config?.statusHeaders?.description?.trim() ?? fallback.statusHeaders.description,
    },
    extraDeckCategoriesText: config?.extraDeckCategoriesText?.trim() ?? fallback.extraDeckCategoriesText,
    faceDownCategoriesText: config?.faceDownCategoriesText?.trim() ?? fallback.faceDownCategoriesText,
    defaultLifePoints: Number.isFinite(config?.defaultLifePoints)
      ? Number(config?.defaultLifePoints)
      : fallback.defaultLifePoints,
    defaultActionPoints: Number.isFinite(config?.defaultActionPoints)
      ? Number(config?.defaultActionPoints)
      : fallback.defaultActionPoints,
  }
}

export function createCrawlv3Player(uid: string, username: string, config: Crawlv3CatalogConfig): Crawlv3PlayerInfo {
  return {
    uid,
    username,
    lifePoints: config.defaultLifePoints,
    actionPoints: config.defaultActionPoints,
  }
}

export function createDefaultCrawlv3LobbyViewState(): Crawlv3LobbyViewState {
  return {
    draftMode: 'catalog',
    draftCategory: '',
    draftChoiceIds: [],
  }
}

export function createCrawlv3Game(uid: string, username: string, config: Crawlv3CatalogConfig): Crawlv3Game {
  return {
    _version: 0,
    code: Math.floor(1000 + Math.random() * 9000),
    status: 'lobby',
    createdBy: uid,
    createdAt: Date.now(),
    config,
    players: {
      player1: createCrawlv3Player(uid, username, config),
      player2: null,
    },
    spectators: [],
    deckSelections: {
      player1: null,
      player2: null,
    },
    lobbyStates: {
      player1: createDefaultCrawlv3LobbyViewState(),
      player2: createDefaultCrawlv3LobbyViewState(),
    },
    lobbyCardSelections: {},
    cardSelections: {},
    cards: {},
    processedActions: [],
  }
}

export function getCrawlv3PlayerKey(game: Crawlv3Game, uid: string): Crawlv3Player | null {
  if (game.players.player1?.uid === uid) return 'player1'
  if (game.players.player2?.uid === uid) return 'player2'
  return null
}

export function isCrawlv3Spectator(game: Crawlv3Game, uid: string) {
  game.spectators = Array.isArray(game.spectators) ? game.spectators : []
  return game.spectators.some((spectator) => spectator.uid === uid)
}

function getCrawlv3Spectator(game: Crawlv3Game, uid: string) {
  game.spectators = Array.isArray(game.spectators) ? game.spectators : []
  return game.spectators.find((spectator) => spectator.uid === uid) ?? null
}

function isCrawlv3Participant(game: Crawlv3Game, uid: string) {
  return !!getCrawlv3PlayerKey(game, uid) || isCrawlv3Spectator(game, uid)
}

function sanitizeSpectatorPerspective(value: unknown): Crawlv3SpectatorPerspective {
  return value === 'player1' || value === 'player2' || value === 'both' ? value : 'both'
}

function sanitizeSelectionVisibility(
  game: Crawlv3Game,
  uid: string,
  instanceId: string | null,
  requested: Crawlv3Player[],
) {
  const actorPlayer = getCrawlv3PlayerKey(game, uid)
  const cardOwner = instanceId ? game.cards[instanceId]?.owner : null

  if (actorPlayer) {
    return cardOwner && cardOwner !== actorPlayer ? [cardOwner] : []
  }

  const allowedPlayers = new Set<Crawlv3Player>(['player1', 'player2'])
  return [...new Set(requested)].filter((player): player is Crawlv3Player => allowedPlayers.has(player))
}

export function addCrawlv3Player2(game: Crawlv3Game, uid: string, username: string) {
  game.config = sanitizeCrawlv3Config(game.config)
  game.players.player2 = createCrawlv3Player(uid, username, game.config)
  game._version = (game._version ?? 0) + 1
}

export function addCrawlv3Spectator(game: Crawlv3Game, uid: string, username: string) {
  game.spectators = Array.isArray(game.spectators) ? game.spectators : []
  if (isCrawlv3Spectator(game, uid)) return
  game.spectators.push({
    uid,
    username,
    joinedAt: Date.now(),
    spectatorPerspective: 'both',
  })
  game._version = (game._version ?? 0) + 1
}

function clampRatio(value: number | undefined, fallback = 0.5) {
  const nextValue = Number.isFinite(value) ? Number(value) : fallback
  return Math.max(0, Math.min(1, nextValue))
}

function sanitizeCard(card: Crawlv3CatalogCard): Crawlv3CatalogCard {
  return {
    id: card.id?.trim() ?? '',
    title: card.title?.trim() ?? '',
    cost: card.cost?.trim() ?? '',
    atk: card.atk?.trim() ?? '',
    def: card.def?.trim() ?? '',
    category: card.category?.trim() ?? '',
    race: card.race?.trim() ?? '',
    damageType: card.damageType?.trim() ?? '',
    img: card.img?.trim() ?? '',
    description: card.description?.trim() ?? '',
    imageUrl: card.imageUrl?.trim() ?? '',
  }
}

function sanitizeStatusRecord(record: Record<string, number> | undefined) {
  const entries = Object.entries(record ?? {})
    .map(([key, value]) => [key.trim(), Number(value)] as const)
    .filter(([key, value]) => key.length > 0 && Number.isFinite(value) && value !== 0)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

  return Object.fromEntries(entries)
}

function sanitizeLobbyViewState(state: Partial<Crawlv3LobbyViewState> | undefined): Crawlv3LobbyViewState {
  const draftMode =
    state?.draftMode === 'categories' || state?.draftMode === 'choices' || state?.draftMode === 'catalog'
      ? state.draftMode
      : 'catalog'

  return {
    draftMode,
    draftCategory: typeof state?.draftCategory === 'string' ? state.draftCategory : '',
    draftChoiceIds: Array.isArray(state?.draftChoiceIds)
      ? state.draftChoiceIds.filter((id): id is string => typeof id === 'string')
      : [],
  }
}

function sanitizePlayerList(players: unknown): Crawlv3Player[] {
  const allowedPlayers = new Set<Crawlv3Player>(['player1', 'player2'])
  return Array.isArray(players)
    ? [...new Set(players)].filter((player): player is Crawlv3Player => allowedPlayers.has(player))
    : []
}

function sanitizeLobbyCardSelections(
  selections: Record<string, Partial<Crawlv3LobbyCardSelection>> | undefined,
): Record<string, Crawlv3LobbyCardSelection> {
  if (!selections || typeof selections !== 'object') return {}

  return Object.fromEntries(
    Object.entries(selections).map(([uid, selection]) => [
      uid,
      {
        cardId: typeof selection?.cardId === 'string' ? selection.cardId : null,
        visibleTo: sanitizePlayerList(selection?.visibleTo),
      },
    ]),
  )
}

function shuffleItems<T>(items: T[]): T[] {
  const nextItems = [...items]
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = nextItems[index]
    nextItems[index] = nextItems[swapIndex]
    nextItems[swapIndex] = current
  }
  return nextItems
}

function resetCardModifiers(card: Crawlv3CardState) {
  card.atk = card.baseAtk
  card.def = card.baseDef
  card.buffs = {}
  card.debuffs = {}
}

function getZoneCards(
  cards: Record<string, Crawlv3CardState>,
  zone: Crawlv3Zone,
  owner?: Crawlv3Player,
): Crawlv3CardState[] {
  return Object.values(cards)
    .filter((card) => card.zone === zone && (!owner || card.owner === owner))
    .sort((left, right) => {
      if (zone === 'deck' || zone === 'extraDeck' || zone === 'discard' || zone === 'exhausted') {
        return left.order - right.order
      }
      if (left.z === right.z) return left.order - right.order
      return left.z - right.z
    })
}

function getNextZoneZ(cards: Record<string, Crawlv3CardState>, zone: Crawlv3Zone, owner?: Crawlv3Player) {
  return getZoneCards(cards, zone, owner).reduce((max, card) => Math.max(max, card.z), 0) + 1
}

function getNextPileOrder(
  cards: Record<string, Crawlv3CardState>,
  zone: Extract<Crawlv3Zone, 'deck' | 'extraDeck' | 'discard' | 'exhausted'>,
  owner: Crawlv3Player,
) {
  return getZoneCards(cards, zone, owner).reduce((max, card) => Math.max(max, card.order), 0) + 1
}

function createCardInstance(
  card: Crawlv3CatalogCard,
  owner: Crawlv3Player,
  order: number,
  zone: Extract<Crawlv3Zone, 'deck' | 'extraDeck'> = 'deck',
): Crawlv3CardState {
  return {
    instanceId: uuid(),
    cardId: card.id,
    owner,
    title: card.title,
    cost: card.cost,
    baseAtk: card.atk,
    baseDef: card.def,
    atk: card.atk,
    def: card.def,
    category: card.category,
    race: card.race,
    damageType: card.damageType,
    img: card.img,
    description: card.description,
    imageUrl: card.imageUrl,
    zone,
    x: 0.5,
    y: 0.5,
    z: order + 1,
    order,
    faceUp: false,
    rotated: false,
    buffs: {},
    debuffs: {},
  }
}

function parseCategoryList(categoriesText: string) {
  return categoriesText
    .split(',')
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean)
}

function cardMatchesCategories(card: Pick<Crawlv3CatalogCard | Crawlv3CardState, 'category'>, categories: string[]) {
  if (!categories.length) return false
  const cardCategories = card.category
    .split(',')
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean)

  return cardCategories.some((category) => categories.includes(category))
}

function getTablePlacement(card: Crawlv3CardState, config: Crawlv3CatalogConfig) {
  const faceDown = cardMatchesCategories(card, parseCategoryList(config.faceDownCategoriesText))
  return {
    faceUp: !faceDown,
    rotated: faceDown,
  }
}

function initializeGameCards(game: Crawlv3Game) {
  const cards: Record<string, Crawlv3CardState> = {}
  const extraDeckCategories = parseCategoryList(game.config.extraDeckCategoriesText)

  for (const playerKey of ['player1', 'player2'] as const) {
    const selection = game.deckSelections[playerKey]
    if (!selection) continue

    const mainDeckCards: Crawlv3CatalogCard[] = []
    const extraDeckCards: Crawlv3CatalogCard[] = []

    for (const card of selection.cards.map(sanitizeCard)) {
      if (cardMatchesCategories(card, extraDeckCategories)) {
        extraDeckCards.push(card)
      } else {
        mainDeckCards.push(card)
      }
    }

    shuffleItems(mainDeckCards).forEach((card, index) => {
      const instance = createCardInstance(card, playerKey, index, 'deck')
      cards[instance.instanceId] = instance
    })

    shuffleItems(extraDeckCards).forEach((card, index) => {
      const instance = createCardInstance(card, playerKey, index, 'extraDeck')
      cards[instance.instanceId] = instance
    })
  }

  game.cards = cards
}

function applyConfigDefaultsToPlayers(game: Crawlv3Game) {
  game.config = sanitizeCrawlv3Config(game.config)
  for (const playerKey of ['player1', 'player2'] as const) {
    const player = game.players[playerKey]
    if (!player) continue
    player.lifePoints = game.config.defaultLifePoints
    player.actionPoints = game.config.defaultActionPoints
  }
}

function completeGame(game: Crawlv3Game) {
  game.status = 'lobby'
  game.cards = {}
  game.cardSelections = {}
  game.lobbyStates = {
    player1: createDefaultCrawlv3LobbyViewState(),
    player2: createDefaultCrawlv3LobbyViewState(),
  }
  game.lobbyCardSelections = {}
  for (const playerKey of ['player1', 'player2'] as const) {
    const selection = game.deckSelections[playerKey]
    if (!selection) continue
    selection.ready = false
    selection.updatedAt = Date.now()
  }
  applyConfigDefaultsToPlayers(game)
}

function applyDeckOrder(game: Crawlv3Game, playerKey: Crawlv3Player, orderedCardIds: string[]) {
  orderedCardIds.forEach((instanceId, index) => {
    const card = game.cards[instanceId]
    if (!card || card.owner !== playerKey) return
    card.zone = 'deck'
    card.x = 0.5
    card.y = 0.5
    card.z = index + 1
    card.order = index
    card.faceUp = false
    card.rotated = false
    resetCardModifiers(card)
  })
}

function applyDiscardRecycleOrder(game: Crawlv3Game, playerKey: Crawlv3Player, orderedCardIds: string[]) {
  const extraDeckCategories = parseCategoryList(game.config.extraDeckCategoriesText)
  let deckOrder = 0
  let extraDeckOrder = getNextPileOrder(game.cards, 'extraDeck', playerKey)

  orderedCardIds.forEach((instanceId) => {
    const card = game.cards[instanceId]
    if (!card || card.owner !== playerKey) return

    const targetZone = cardMatchesCategories(card, extraDeckCategories) ? 'extraDeck' : 'deck'
    card.zone = targetZone
    card.x = 0.5
    card.y = 0.5
    card.z = targetZone === 'extraDeck' ? extraDeckOrder + 1 : deckOrder + 1
    card.order = targetZone === 'extraDeck' ? extraDeckOrder : deckOrder
    card.faceUp = false
    card.rotated = false
    resetCardModifiers(card)

    if (targetZone === 'extraDeck') {
      extraDeckOrder += 1
    } else {
      deckOrder += 1
    }
  })
}

function startGameIfReady(game: Crawlv3Game) {
  if (!game.players.player1 || !game.players.player2) return
  if (!game.deckSelections.player1 || !game.deckSelections.player2) return
  if (!game.deckSelections.player1.ready || !game.deckSelections.player2.ready) return
  if (!game.deckSelections.player1.cards.length || !game.deckSelections.player2.cards.length) return

  initializeGameCards(game)
  applyConfigDefaultsToPlayers(game)
  game.status = 'active'
}

function handleLobbyAction(game: Crawlv3Game, action: Crawlv3Action, playerKey: Crawlv3Player): Crawlv3ActionResult {
  switch (action.type) {
    case 'update_config': {
      if (playerKey !== 'player1') {
        return { success: false, error: 'Only the host can update the room config' }
      }
      const nextConfig = sanitizeCrawlv3Config(action.config)
      game.config = nextConfig
      applyConfigDefaultsToPlayers(game)
      return { success: true }
    }
    case 'select_deck': {
      game.deckSelections[playerKey] = {
        cards: action.cards.map(sanitizeCard).filter((card) => card.id.length > 0 && card.title.length > 0),
        ready: false,
        updatedAt: Date.now(),
      }
      return { success: true }
    }
    case 'set_ready': {
      const selection = game.deckSelections[playerKey]
      if (!selection) {
        return action.ready ? { success: false, error: 'Select a deck before readying up' } : { success: true }
      }
      if (action.ready && !selection.cards.length) {
        return { success: false, error: 'Select at least one card before readying up' }
      }

      selection.ready = action.ready
      selection.updatedAt = Date.now()
      startGameIfReady(game)
      return { success: true }
    }
    case 'update_lobby_state': {
      game.lobbyStates[playerKey] = sanitizeLobbyViewState(action.state)
      return { success: true }
    }
    default:
      return { success: false, error: 'This action is only available after the game starts' }
  }
}

function idsMatchCurrentCards(currentIds: string[], requestedIds: string[]) {
  if (currentIds.length !== requestedIds.length) return false
  return currentIds.every((instanceId, index) => requestedIds[index] === instanceId)
}

function handleActiveAction(game: Crawlv3Game, action: Crawlv3Action, playerKey: Crawlv3Player): Crawlv3ActionResult {
  switch (action.type) {
    case 'move_card': {
      const card = game.cards[action.instanceId]
      if (!card) return { success: false, error: 'Card not found' }
      if (card.owner !== playerKey) return { success: false, error: 'You can only move your own cards' }

      const previousZone = card.zone
      card.zone = action.zone
      card.x =
        action.zone === 'deck' ||
        action.zone === 'extraDeck' ||
        action.zone === 'discard' ||
        action.zone === 'exhausted'
          ? 0.5
          : clampRatio(action.x)
      card.y =
        action.zone === 'deck' ||
        action.zone === 'extraDeck' ||
        action.zone === 'discard' ||
        action.zone === 'exhausted'
          ? 0.5
          : clampRatio(action.y)
      card.z = getNextZoneZ(game.cards, action.zone, action.zone === 'table' ? undefined : playerKey)
      if (action.zone === 'table' && previousZone !== 'table') {
        const placement = getTablePlacement(card, game.config)
        card.faceUp = action.faceUp ?? placement.faceUp
        card.rotated = action.rotated ?? placement.rotated
      } else {
        if (action.faceUp !== undefined) card.faceUp = action.faceUp
        if (action.rotated !== undefined) card.rotated = action.rotated
      }
      if (action.zone === 'hand') {
        card.faceUp = action.faceUp ?? true
        card.rotated = false
      }
      if (
        action.zone === 'deck' ||
        action.zone === 'extraDeck' ||
        action.zone === 'discard' ||
        action.zone === 'exhausted'
      ) {
        card.order = getNextPileOrder(game.cards, action.zone, playerKey)
        card.faceUp = action.zone === 'discard' || action.zone === 'exhausted'
        card.rotated = false
        resetCardModifiers(card)
      }
      return { success: true }
    }
    case 'patch_card': {
      const card = game.cards[action.instanceId]
      if (!card) return { success: false, error: 'Card not found' }
      if (card.owner !== playerKey) return { success: false, error: 'You can only edit your own cards' }

      if (action.patch.faceUp !== undefined) card.faceUp = action.patch.faceUp
      if (action.patch.rotated !== undefined) card.rotated = action.patch.rotated
      if (action.patch.atk !== undefined) card.atk = String(action.patch.atk)
      if (action.patch.def !== undefined) card.def = String(action.patch.def)
      if (action.patch.race !== undefined) card.race = String(action.patch.race)
      if (action.patch.damageType !== undefined) card.damageType = String(action.patch.damageType)
      if (action.patch.buffs) card.buffs = sanitizeStatusRecord(action.patch.buffs)
      if (action.patch.debuffs) card.debuffs = sanitizeStatusRecord(action.patch.debuffs)
      return { success: true }
    }
    case 'set_player_stats': {
      if (action.player !== playerKey) return { success: false, error: 'You can only update your own stats' }

      const targetPlayer = game.players[action.player]
      if (!targetPlayer) return { success: false, error: 'Player not found' }

      if (action.lifePoints !== undefined) {
        const nextLifePoints = Number(action.lifePoints)
        if (Number.isFinite(nextLifePoints)) targetPlayer.lifePoints = nextLifePoints
      }
      if (action.actionPoints !== undefined) {
        const nextActionPoints = Number(action.actionPoints)
        if (Number.isFinite(nextActionPoints)) targetPlayer.actionPoints = nextActionPoints
      }
      return { success: true }
    }
    case 'shuffle_deck': {
      const currentIds = getZoneCards(game.cards, 'deck', playerKey)
        .map((card) => card.instanceId)
        .sort()
      const requestedIds = [...action.orderedCardIds].sort()

      if (!idsMatchCurrentCards(currentIds, requestedIds)) {
        return { success: false, error: 'Draw shuffle payload did not match the current draw pile' }
      }

      applyDeckOrder(game, playerKey, action.orderedCardIds)
      return { success: true }
    }
    case 'shuffle_discard_into_deck': {
      const currentIds = [
        ...getZoneCards(game.cards, 'deck', playerKey),
        ...getZoneCards(game.cards, 'discard', playerKey),
      ]
        .map((card) => card.instanceId)
        .sort()
      const requestedIds = [...action.orderedCardIds].sort()

      if (!idsMatchCurrentCards(currentIds, requestedIds)) {
        return { success: false, error: 'Spent recycle payload did not match the current draw and spent piles' }
      }

      applyDiscardRecycleOrder(game, playerKey, action.orderedCardIds)
      return { success: true }
    }
    case 'complete_game': {
      completeGame(game)
      return { success: true }
    }
    default:
      return { success: false, error: 'This action is only available in the lobby' }
  }
}

export function applyAuthenticatedCrawlv3Action(
  game: Crawlv3Game,
  action: Crawlv3Action,
  uid: string,
): Crawlv3ActionResult {
  game.config = sanitizeCrawlv3Config(game.config)
  game.spectators = Array.isArray(game.spectators)
    ? game.spectators.map((spectator) => ({
        ...spectator,
        spectatorPerspective: sanitizeSpectatorPerspective(spectator.spectatorPerspective),
      }))
    : []
  game.lobbyStates = {
    player1: sanitizeLobbyViewState(game.lobbyStates?.player1),
    player2: sanitizeLobbyViewState(game.lobbyStates?.player2),
  }
  game.lobbyCardSelections = sanitizeLobbyCardSelections(game.lobbyCardSelections)
  game.cardSelections = game.cardSelections && typeof game.cardSelections === 'object' ? game.cardSelections : {}
  game.processedActions = Array.isArray(game.processedActions) ? game.processedActions : []
  const playerKey = getCrawlv3PlayerKey(game, uid)

  if (game.processedActions.includes(action.actionId)) {
    return { success: true }
  }

  if (action.type === 'select_card') {
    if (!isCrawlv3Participant(game, uid)) {
      return { success: false, error: 'Not a participant in this game' }
    }
    if (action.instanceId && !game.cards[action.instanceId]) {
      return { success: false, error: 'Card not found' }
    }
    game.cardSelections[uid] = {
      instanceId: action.instanceId,
      visibleTo: sanitizeSelectionVisibility(game, uid, action.instanceId, action.visibleTo),
    }
    game.processedActions.push(action.actionId)
    if (game.processedActions.length > 100) game.processedActions.shift()
    game._version = (game._version ?? 0) + 1
    return { success: true }
  }

  if (action.type === 'select_lobby_card') {
    if (!isCrawlv3Participant(game, uid)) {
      return { success: false, error: 'Not a participant in this game' }
    }

    game.lobbyCardSelections[uid] = {
      cardId: typeof action.cardId === 'string' ? action.cardId : null,
      visibleTo: sanitizePlayerList(action.visibleTo),
    }
    game.processedActions.push(action.actionId)
    if (game.processedActions.length > 100) game.processedActions.shift()
    game._version = (game._version ?? 0) + 1
    return { success: true }
  }

  if (action.type === 'update_spectator_perspective') {
    const spectator = getCrawlv3Spectator(game, uid)
    if (!spectator) {
      return { success: false, error: 'Only spectators can update spectator perspective' }
    }

    spectator.spectatorPerspective = sanitizeSpectatorPerspective(action.perspective)
    game.processedActions.push(action.actionId)
    if (game.processedActions.length > 100) game.processedActions.shift()
    game._version = (game._version ?? 0) + 1
    return { success: true }
  }

  if (!playerKey) {
    return { success: false, error: 'Spectators cannot perform game actions' }
  }

  const result =
    game.status === 'lobby' ? handleLobbyAction(game, action, playerKey) : handleActiveAction(game, action, playerKey)

  if (!result.success) return result

  game.processedActions.push(action.actionId)
  if (game.processedActions.length > 100) game.processedActions.shift()

  game._version = (game._version ?? 0) + 1
  return result
}
