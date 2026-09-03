import type {
  Crawlv3Action,
  Crawlv3CardState,
  Crawlv3CatalogCard,
  Crawlv3CatalogConfig,
  Crawlv3DeckSelection,
  Crawlv3Game,
  Crawlv3LobbyCardSelection,
  Crawlv3LobbyViewState,
  Crawlv3Player,
  Crawlv3PlayerInfo,
  Crawlv3Zone,
} from '@/types/crawlv3'

import { createDefaultCrawlv3Config } from './catalog'

function randomRoomCode() {
  return Math.floor(1000 + Math.random() * 9000)
}

export function createDefaultCrawlv3LobbyViewState(): Crawlv3LobbyViewState {
  return {
    draftMode: 'catalog',
    draftCategory: '',
    draftChoiceIds: [],
  }
}

export function createPlayerInfo(uid: string, username: string, config: Crawlv3CatalogConfig): Crawlv3PlayerInfo {
  const normalizedConfig = normalizeConfigDefaults(config)
  return {
    uid,
    username,
    lifePoints: normalizedConfig.defaultLifePoints,
    actionPoints: normalizedConfig.defaultActionPoints,
  }
}

export function createEmptyCrawlv3Game(): Crawlv3Game {
  return {
    _version: 0,
    code: randomRoomCode(),
    status: 'lobby',
    createdBy: '',
    createdAt: Date.now(),
    config: createDefaultCrawlv3Config(),
    players: {
      player1: null,
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

export function cloneGame<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function clampRatio(value: number | undefined, fallback = 0.5): number {
  const nextValue = Number.isFinite(value) ? Number(value) : fallback
  return Math.max(0, Math.min(1, nextValue))
}

export function normalizeConfigDefaults(config: Crawlv3CatalogConfig): Crawlv3CatalogConfig {
  const defaults = createDefaultCrawlv3Config()

  return {
    ...config,
    fieldImageUrl: config.fieldImageUrl ?? defaults.fieldImageUrl,
    extraDeckCategoriesText: config.extraDeckCategoriesText ?? 'Fusion Unit, Ritual Unit',
    faceDownCategoriesText: config.faceDownCategoriesText ?? 'Trap',
    defaultLifePoints: Number.isFinite(config.defaultLifePoints) ? Number(config.defaultLifePoints) : 8000,
    defaultActionPoints: Number.isFinite(config.defaultActionPoints) ? Number(config.defaultActionPoints) : 0,
  }
}

export function normalizeLobbyViewState(state: Partial<Crawlv3LobbyViewState> | undefined): Crawlv3LobbyViewState {
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

function normalizePlayerList(players: unknown): Crawlv3Player[] {
  const allowedPlayers = new Set<Crawlv3Player>(['player1', 'player2'])
  return Array.isArray(players)
    ? [...new Set(players)].filter((player): player is Crawlv3Player => allowedPlayers.has(player))
    : []
}

export function normalizeLobbyCardSelections(
  selections: Record<string, Partial<Crawlv3LobbyCardSelection>> | undefined,
): Record<string, Crawlv3LobbyCardSelection> {
  if (!selections || typeof selections !== 'object') return {}

  return Object.fromEntries(
    Object.entries(selections).map(([uid, selection]) => [
      uid,
      {
        cardId: typeof selection?.cardId === 'string' ? selection.cardId : null,
        visibleTo: normalizePlayerList(selection?.visibleTo),
      },
    ]),
  )
}

export function sanitizeStatusRecord(record: Record<string, number> | undefined) {
  const entries = Object.entries(record ?? {})
    .map(([key, value]) => [key.trim(), Number(value)] as const)
    .filter(([key, value]) => key.length > 0 && Number.isFinite(value) && value !== 0)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

  return Object.fromEntries(entries)
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

function parseCategoryList(categoriesText: string) {
  return categoriesText
    .split(',')
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean)
}

function cardMatchesCategories(card: Pick<Crawlv3CardState, 'category'>, categories: string[]) {
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

export function getZoneCards(
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

export function getNextZoneZ(
  cards: Record<string, Crawlv3CardState>,
  zone: Crawlv3Zone,
  owner?: Crawlv3Player,
): number {
  return getZoneCards(cards, zone, owner).reduce((max, card) => Math.max(max, card.z), 0) + 1
}

export function getNextDeckOrder(cards: Record<string, Crawlv3CardState>, owner: Crawlv3Player): number {
  return getNextPileOrder(cards, 'deck', owner)
}

export function getNextPileOrder(
  cards: Record<string, Crawlv3CardState>,
  zone: Extract<Crawlv3Zone, 'deck' | 'extraDeck' | 'discard' | 'exhausted'>,
  owner: Crawlv3Player,
): number {
  return getZoneCards(cards, zone, owner).reduce((max, card) => Math.max(max, card.order), 0) + 1
}

export function getTopDeckCard(cards: Record<string, Crawlv3CardState>, owner: Crawlv3Player) {
  return getTopPileCard(cards, 'deck', owner)
}

export function getTopPileCard(
  cards: Record<string, Crawlv3CardState>,
  zone: Extract<Crawlv3Zone, 'deck' | 'extraDeck' | 'discard' | 'exhausted'>,
  owner: Crawlv3Player,
) {
  const pileCards = getZoneCards(cards, zone, owner)
  return pileCards[pileCards.length - 1]
}

function applyDeckOrder(cards: Record<string, Crawlv3CardState>, owner: Crawlv3Player, orderedCardIds: string[]) {
  orderedCardIds.forEach((instanceId, index) => {
    const card = cards[instanceId]
    if (!card || card.owner !== owner) return
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

function applyDiscardRecycleOrder(
  cards: Record<string, Crawlv3CardState>,
  owner: Crawlv3Player,
  orderedCardIds: string[],
  config: Crawlv3CatalogConfig,
) {
  const extraDeckCategories = parseCategoryList(config.extraDeckCategoriesText)
  let deckOrder = 0
  let extraDeckOrder = getNextPileOrder(cards, 'extraDeck', owner)

  orderedCardIds.forEach((instanceId) => {
    const card = cards[instanceId]
    if (!card || card.owner !== owner) return

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

export function isCardVisibleToPlayer(card: Crawlv3CardState, viewer: Crawlv3Player | null): boolean {
  if (!viewer) return card.zone !== 'hand' && card.zone !== 'discard' && card.zone !== 'exhausted' && card.faceUp
  if (card.owner === viewer) return true
  if (card.zone === 'hand' || card.zone === 'discard' || card.zone === 'exhausted') return false
  return card.faceUp
}

export function selectionToCardInstances(
  selection: Crawlv3DeckSelection,
  owner: Crawlv3Player,
  createInstanceId: () => string,
): Record<string, Crawlv3CardState> {
  const cards = shuffleItems(selection.cards).reduce<Record<string, Crawlv3CardState>>((accumulator, card, index) => {
    const instanceId = createInstanceId()
    accumulator[instanceId] = createCardInstance(card, owner, instanceId, index)
    return accumulator
  }, {})

  return cards
}

export function createCardInstance(
  card: Crawlv3CatalogCard,
  owner: Crawlv3Player,
  instanceId: string,
  order: number,
): Crawlv3CardState {
  return {
    instanceId,
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
    zone: 'deck',
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

export function applyConfigDefaultsToPlayers(game: Crawlv3Game) {
  game.config = normalizeConfigDefaults(game.config)
  for (const playerKey of ['player1', 'player2'] as const) {
    const player = game.players[playerKey]
    if (!player) continue
    player.lifePoints = game.config.defaultLifePoints
    player.actionPoints = game.config.defaultActionPoints
  }
}

export function completeCrawlv3Game(game: Crawlv3Game) {
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

export function applyCrawlv3Action(
  game: Crawlv3Game,
  action: Crawlv3Action,
  actor?: Crawlv3Player,
  actorUid?: string,
): Crawlv3Game {
  const nextGame = cloneGame(game)

  switch (action.type) {
    case 'update_config': {
      const nextConfig = normalizeConfigDefaults(cloneGame(action.config) as Crawlv3CatalogConfig)
      nextGame.config = nextConfig
      applyConfigDefaultsToPlayers(nextGame)
      break
    }
    case 'select_deck': {
      if (!actor) break
      nextGame.deckSelections[actor] = {
        cards: cloneGame(action.cards),
        ready: false,
        updatedAt: Date.now(),
      }
      break
    }
    case 'set_ready': {
      if (!actor || !nextGame.deckSelections[actor]) break
      if (action.ready && !nextGame.deckSelections[actor].cards.length) break
      nextGame.deckSelections[actor].ready = action.ready
      break
    }
    case 'update_lobby_state': {
      if (!actor) break
      nextGame.lobbyStates = nextGame.lobbyStates ?? {
        player1: createDefaultCrawlv3LobbyViewState(),
        player2: createDefaultCrawlv3LobbyViewState(),
      }
      nextGame.lobbyStates[actor] = normalizeLobbyViewState(action.state)
      break
    }
    case 'select_lobby_card': {
      if (!actorUid) break
      nextGame.lobbyCardSelections = nextGame.lobbyCardSelections ?? {}
      nextGame.lobbyCardSelections[actorUid] = {
        cardId: typeof action.cardId === 'string' ? action.cardId : null,
        visibleTo: normalizePlayerList(action.visibleTo),
      }
      break
    }
    case 'select_card': {
      if (!actorUid) break
      nextGame.cardSelections = nextGame.cardSelections ?? {}
      nextGame.cardSelections[actorUid] = {
        instanceId: action.instanceId,
        visibleTo: action.visibleTo,
      }
      break
    }
    case 'update_spectator_perspective': {
      if (!actorUid) break
      const spectator = nextGame.spectators.find((entry) => entry.uid === actorUid)
      if (!spectator) break
      spectator.spectatorPerspective = action.perspective
      break
    }
    case 'move_card': {
      if (!actor) break
      const card = nextGame.cards[action.instanceId]
      if (!card || card.owner !== actor) break

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
      card.z = getNextZoneZ(nextGame.cards, action.zone, action.zone === 'table' ? undefined : actor)
      if (action.zone === 'table' && previousZone !== 'table') {
        const placement = getTablePlacement(card, nextGame.config)
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
        card.order = getNextPileOrder(nextGame.cards, action.zone, actor)
        card.faceUp = action.zone === 'discard' || action.zone === 'exhausted'
        card.rotated = false
        resetCardModifiers(card)
      }
      break
    }
    case 'patch_card': {
      if (!actor) break
      const card = nextGame.cards[action.instanceId]
      if (!card || card.owner !== actor) break

      if (action.patch.faceUp !== undefined) card.faceUp = action.patch.faceUp
      if (action.patch.rotated !== undefined) card.rotated = action.patch.rotated
      if (action.patch.atk !== undefined) card.atk = action.patch.atk
      if (action.patch.def !== undefined) card.def = action.patch.def
      if (action.patch.race !== undefined) card.race = action.patch.race
      if (action.patch.damageType !== undefined) card.damageType = action.patch.damageType
      if (action.patch.buffs) card.buffs = sanitizeStatusRecord(action.patch.buffs)
      if (action.patch.debuffs) card.debuffs = sanitizeStatusRecord(action.patch.debuffs)
      break
    }
    case 'set_player_stats': {
      const playerState = nextGame.players[action.player]
      if (!playerState) break
      if (action.lifePoints !== undefined) playerState.lifePoints = action.lifePoints
      if (action.actionPoints !== undefined) playerState.actionPoints = action.actionPoints
      break
    }
    case 'shuffle_deck': {
      if (!actor) break
      applyDeckOrder(nextGame.cards, actor, action.orderedCardIds)
      break
    }
    case 'shuffle_discard_into_deck': {
      if (!actor) break
      applyDiscardRecycleOrder(nextGame.cards, actor, action.orderedCardIds, nextGame.config)
      break
    }
    case 'complete_game': {
      completeCrawlv3Game(nextGame)
      break
    }
  }

  return nextGame
}
