import { addDoc, collection } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

type Crawlv3Player = 'player1' | 'player2'

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

interface Crawlv3PlayerInfo {
  uid: string
  username: string
  lifePoints: number
  actionPoints: number
}

interface Crawlv3DeckSelection {
  cards: unknown[]
  ready: boolean
  updatedAt: number
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
  cards: Record<string, unknown>
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

function createPlayer(uid: string, username: string, config: Crawlv3CatalogConfig): Crawlv3PlayerInfo {
  return {
    uid,
    username,
    lifePoints: config.defaultLifePoints,
    actionPoints: config.defaultActionPoints,
  }
}

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body) as { username: string; config?: Crawlv3CatalogConfig }
    const code = Math.floor(1000 + Math.random() * 9000)
    const config = sanitizeConfig(body.config)

    const game: Crawlv3Game = {
      _version: 0,
      code,
      status: 'lobby',
      createdBy: authResult.auth.uid,
      createdAt: Date.now(),
      config,
      players: {
        player1: createPlayer(authResult.auth.uid, body.username, config),
        player2: null,
      },
      deckSelections: {
        player1: null,
        player2: null,
      },
      cards: {},
      processedActions: [],
    }

    const docRef = await addDoc(collection(db, 'crawlv3_games'), game)

    return {
      statusCode: 200,
      body: JSON.stringify({ id: docRef.id, code }),
      headers: { 'Content-Type': 'application/json' },
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
