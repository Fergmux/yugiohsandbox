import { doc, runTransaction } from 'firebase/firestore'
import { v4 as uuid } from 'uuid'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

type Crawlv3Player = 'player1' | 'player2'
type Crawlv3Zone = 'table' | 'hand' | 'deck' | 'discard'

interface Crawlv3CatalogHeaders {
  id: string
  title: string
  cost: string
  atk: string
  def: string
  category: string
  race: string
  damageType: string
  description: string
}

interface Crawlv3StatusHeaders {
  id: string
  name: string
  type: string
  description: string
}

interface Crawlv3CatalogConfig {
  csvUrl: string
  headers: Crawlv3CatalogHeaders
  imageUrlTemplate: string
  imageOverridesText: string
  statusCsvUrl: string
  statusHeaders: Crawlv3StatusHeaders
  defaultLifePoints: number
  defaultActionPoints: number
}

interface Crawlv3CatalogCard {
  id: string
  title: string
  cost: string
  atk: string
  def: string
  category: string
  race: string
  damageType: string
  description: string
  imageUrl: string
}

interface Crawlv3DeckSelection {
  cards: Crawlv3CatalogCard[]
  ready: boolean
  updatedAt: number
}

interface Crawlv3PlayerInfo {
  uid: string
  username: string
  lifePoints: number
  actionPoints: number
}

interface Crawlv3CardState {
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

interface Crawlv3Game {
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

function createDefaultConfig(): Crawlv3CatalogConfig {
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
      description: '',
    },
    imageUrlTemplate: '',
    imageOverridesText: '',
    statusCsvUrl: '',
    statusHeaders: {
      id: 'id',
      name: 'name',
      type: 'type',
      description: 'description',
    },
    defaultLifePoints: 8000,
    defaultActionPoints: 0,
  }
}

type Crawlv3Action =
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

type ActionResult = { success: true } | { success: false; error: string }

function clampRatio(value: number | undefined, fallback = 0.5) {
  const nextValue = Number.isFinite(value) ? Number(value) : fallback
  return Math.max(0, Math.min(1, nextValue))
}

function sanitizeConfig(config: Crawlv3CatalogConfig | undefined): Crawlv3CatalogConfig {
  const fallback = createDefaultConfig()

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
      description: config?.headers?.description?.trim() ?? fallback.headers.description,
    },
    imageUrlTemplate: config?.imageUrlTemplate?.trim() ?? fallback.imageUrlTemplate,
    imageOverridesText: config?.imageOverridesText ?? fallback.imageOverridesText,
    statusCsvUrl: config?.statusCsvUrl?.trim() ?? fallback.statusCsvUrl,
    statusHeaders: {
      id: config?.statusHeaders?.id?.trim() ?? fallback.statusHeaders.id,
      name: config?.statusHeaders?.name?.trim() ?? fallback.statusHeaders.name,
      type: config?.statusHeaders?.type?.trim() ?? fallback.statusHeaders.type,
      description: config?.statusHeaders?.description?.trim() ?? fallback.statusHeaders.description,
    },
    defaultLifePoints: Number.isFinite(config?.defaultLifePoints)
      ? Number(config?.defaultLifePoints)
      : fallback.defaultLifePoints,
    defaultActionPoints: Number.isFinite(config?.defaultActionPoints)
      ? Number(config?.defaultActionPoints)
      : fallback.defaultActionPoints,
  }
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
    description: card.description?.trim() ?? '',
    imageUrl: card.imageUrl?.trim() ?? '',
  }
}

function sanitizeStatusRecord(record: Record<string, number> | undefined) {
  const entries = Object.entries(record ?? {})
    .map(([key, value]) => [key.trim(), Number(value)] as const)
    .filter(([key, value]) => key.length > 0 && Number.isFinite(value) && value !== 0)

  return Object.fromEntries(entries)
}

function getPlayerKey(game: Crawlv3Game, uid: string): Crawlv3Player | null {
  if (game.players.player1?.uid === uid) return 'player1'
  if (game.players.player2?.uid === uid) return 'player2'
  return null
}

function getZoneCards(
  cards: Record<string, Crawlv3CardState>,
  zone: Crawlv3Zone,
  owner?: Crawlv3Player,
): Crawlv3CardState[] {
  return Object.values(cards)
    .filter((card) => card.zone === zone && (!owner || card.owner === owner))
    .sort((left, right) => {
      if (zone === 'deck') return left.order - right.order
      if (left.z === right.z) return left.order - right.order
      return left.z - right.z
    })
}

function getNextZoneZ(cards: Record<string, Crawlv3CardState>, zone: Crawlv3Zone, owner?: Crawlv3Player) {
  return getZoneCards(cards, zone, owner).reduce((max, card) => Math.max(max, card.z), 0) + 1
}

function getNextDeckOrder(cards: Record<string, Crawlv3CardState>, owner: Crawlv3Player) {
  return getNextPileOrder(cards, 'deck', owner)
}

function getNextPileOrder(
  cards: Record<string, Crawlv3CardState>,
  zone: Extract<Crawlv3Zone, 'deck' | 'discard'>,
  owner: Crawlv3Player,
) {
  return getZoneCards(cards, zone, owner).reduce((max, card) => Math.max(max, card.order), 0) + 1
}

function createCardInstance(card: Crawlv3CatalogCard, owner: Crawlv3Player, order: number): Crawlv3CardState {
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

function initializeGameCards(game: Crawlv3Game) {
  const cards: Record<string, Crawlv3CardState> = {}

  ;(['player1', 'player2'] as const).forEach((playerKey) => {
    const selection = game.deckSelections[playerKey]
    if (!selection) return

    selection.cards.map(sanitizeCard).forEach((card, index) => {
      const instance = createCardInstance(card, playerKey, index)
      cards[instance.instanceId] = instance
    })
  })

  game.cards = cards
}

function applyConfigDefaultsToPlayers(game: Crawlv3Game) {
  game.config = sanitizeConfig(game.config)
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
  })
}

function startGameIfReady(game: Crawlv3Game) {
  if (!game.players.player1 || !game.players.player2) return
  if (!game.deckSelections.player1 || !game.deckSelections.player2) return
  if (!game.deckSelections.player1.ready || !game.deckSelections.player2.ready) return

  initializeGameCards(game)
  applyConfigDefaultsToPlayers(game)
  game.status = 'active'
}

function handleLobbyAction(game: Crawlv3Game, action: Crawlv3Action, playerKey: Crawlv3Player): ActionResult {
  switch (action.type) {
    case 'update_config': {
      if (playerKey !== 'player1') {
        return { success: false, error: 'Only the host can update the room config' }
      }
      game.config = sanitizeConfig(action.config)
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
      game.deckSelections[playerKey] = {
        cards: game.deckSelections[playerKey]?.cards ?? [],
        ready: action.ready,
        updatedAt: Date.now(),
      }
      startGameIfReady(game)
      return { success: true }
    }
    default:
      return { success: false, error: 'This action is only available after the game starts' }
  }
}

function handleActiveAction(game: Crawlv3Game, action: Crawlv3Action, playerKey: Crawlv3Player): ActionResult {
  switch (action.type) {
    case 'move_card': {
      const card = game.cards[action.instanceId]
      if (!card) return { success: false, error: 'Card not found' }
      if (card.owner !== playerKey) return { success: false, error: 'You can only move your own cards' }

      card.zone = action.zone
      card.x = action.zone === 'deck' || action.zone === 'discard' ? 0.5 : clampRatio(action.x)
      card.y = action.zone === 'deck' || action.zone === 'discard' ? 0.5 : clampRatio(action.y)
      card.z = getNextZoneZ(game.cards, action.zone, action.zone === 'table' ? undefined : playerKey)
      if (action.faceUp !== undefined) card.faceUp = action.faceUp
      if (action.rotated !== undefined) card.rotated = action.rotated
      if (action.zone === 'hand') {
        card.rotated = false
      }
      if (action.zone === 'deck' || action.zone === 'discard') {
        card.order = getNextPileOrder(game.cards, action.zone, playerKey)
        card.faceUp = action.zone === 'discard'
        card.rotated = false
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
      if (action.patch.buffs) card.buffs = sanitizeStatusRecord(action.patch.buffs)
      if (action.patch.debuffs) card.debuffs = sanitizeStatusRecord(action.patch.debuffs)
      return { success: true }
    }
    case 'set_player_stats': {
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
      const deckCards = getZoneCards(game.cards, 'deck', playerKey)
      const currentIds = deckCards.map((card) => card.instanceId).sort()
      const requestedIds = [...action.orderedCardIds].sort()

      if (
        currentIds.length !== requestedIds.length ||
        currentIds.some((instanceId, index) => requestedIds[index] !== instanceId)
      ) {
        return { success: false, error: 'Deck shuffle payload did not match the current deck' }
      }

      applyDeckOrder(game, playerKey, action.orderedCardIds)
      return { success: true }
    }
    case 'shuffle_discard_into_deck': {
      const deckCards = getZoneCards(game.cards, 'deck', playerKey)
      const discardCards = getZoneCards(game.cards, 'discard', playerKey)
      const currentIds = [...deckCards, ...discardCards].map((card) => card.instanceId).sort()
      const requestedIds = [...action.orderedCardIds].sort()

      if (
        currentIds.length !== requestedIds.length ||
        currentIds.some((instanceId, index) => requestedIds[index] !== instanceId)
      ) {
        return { success: false, error: 'Discard recycle payload did not match the current deck and discard piles' }
      }

      applyDeckOrder(game, playerKey, action.orderedCardIds)
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

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body) as { gameId: string; action: Crawlv3Action }
    if (!body.gameId || !body.action) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'gameId and action are required' }),
      }
    }

    const docRef = doc(db, 'crawlv3_games', body.gameId)
    let result: ActionResult = { success: false, error: 'Unknown error' }
    let committedVersion: number | null = null

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(docRef)
      if (!snapshot.exists()) {
        result = { success: false, error: 'Game not found' }
        return
      }

      const game = snapshot.data() as Crawlv3Game
      game.config = sanitizeConfig(game.config)
      const playerKey = getPlayerKey(game, authResult.auth.uid)

      if (!playerKey) {
        result = { success: false, error: 'Not a player in this game' }
        return
      }

      if (game.processedActions.includes(body.action.actionId)) {
        result = { success: true }
        committedVersion = game._version ?? 0
        return
      }

      result =
        game.status === 'lobby'
          ? handleLobbyAction(game, body.action, playerKey)
          : handleActiveAction(game, body.action, playerKey)

      if (!result.success) return

      game.processedActions.push(body.action.actionId)
      if (game.processedActions.length > 100) game.processedActions.shift()

      game._version = (game._version ?? 0) + 1
      committedVersion = game._version
      transaction.set(docRef, game)
    })

    if (!result.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: result.error }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, version: committedVersion }),
    }
  } catch (err) {
    console.error(err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: err instanceof Error ? err.message : String(err) }),
    }
  }
}

export { handler }
