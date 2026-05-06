import type {
  Crawlv3Action,
  Crawlv3CardState,
  Crawlv3CatalogCard,
  Crawlv3CatalogConfig,
  Crawlv3DeckSelection,
  Crawlv3Game,
  Crawlv3Player,
  Crawlv3PlayerInfo,
  Crawlv3Zone,
} from '@/types/crawlv3'

import { createDefaultCrawlv3Config } from './catalog'

function randomRoomCode() {
  return Math.floor(1000 + Math.random() * 9000)
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
    deckSelections: {
      player1: null,
      player2: null,
    },
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
  return {
    ...config,
    defaultLifePoints: Number.isFinite(config.defaultLifePoints) ? Number(config.defaultLifePoints) : 8000,
    defaultActionPoints: Number.isFinite(config.defaultActionPoints) ? Number(config.defaultActionPoints) : 0,
  }
}

export function sanitizeStatusRecord(record: Record<string, number> | undefined) {
  const entries = Object.entries(record ?? {})
    .map(([key, value]) => [key.trim(), Number(value)] as const)
    .filter(([key, value]) => key.length > 0 && Number.isFinite(value) && value !== 0)

  return Object.fromEntries(entries)
}

export function getZoneCards(
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
  zone: Extract<Crawlv3Zone, 'deck' | 'discard'>,
  owner: Crawlv3Player,
): number {
  return getZoneCards(cards, zone, owner).reduce((max, card) => Math.max(max, card.order), 0) + 1
}

export function getTopDeckCard(cards: Record<string, Crawlv3CardState>, owner: Crawlv3Player) {
  return getTopPileCard(cards, 'deck', owner)
}

export function getTopPileCard(
  cards: Record<string, Crawlv3CardState>,
  zone: Extract<Crawlv3Zone, 'deck' | 'discard'>,
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
  })
}

export function isCardVisibleToPlayer(card: Crawlv3CardState, viewer: Crawlv3Player | null): boolean {
  if (!viewer) return card.zone !== 'hand' && card.faceUp
  if (card.owner === viewer) return true
  if (card.zone === 'hand') return false
  return card.faceUp
}

export function selectionToCardInstances(
  selection: Crawlv3DeckSelection,
  owner: Crawlv3Player,
  createInstanceId: () => string,
): Record<string, Crawlv3CardState> {
  const cards = selection.cards.reduce<Record<string, Crawlv3CardState>>((accumulator, card, index) => {
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
  for (const playerKey of ['player1', 'player2'] as const) {
    const selection = game.deckSelections[playerKey]
    if (!selection) continue
    selection.ready = false
    selection.updatedAt = Date.now()
  }
  applyConfigDefaultsToPlayers(game)
}

export function applyCrawlv3Action(game: Crawlv3Game, action: Crawlv3Action, actor?: Crawlv3Player): Crawlv3Game {
  const nextGame = cloneGame(game)

  switch (action.type) {
    case 'update_config': {
      nextGame.config = cloneGame(action.config) as Crawlv3CatalogConfig
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
      nextGame.deckSelections[actor].ready = action.ready
      break
    }
    case 'move_card': {
      if (!actor) break
      const card = nextGame.cards[action.instanceId]
      if (!card || card.owner !== actor) break

      card.zone = action.zone
      card.x = action.zone === 'deck' || action.zone === 'discard' ? 0.5 : clampRatio(action.x)
      card.y = action.zone === 'deck' || action.zone === 'discard' ? 0.5 : clampRatio(action.y)
      card.z = getNextZoneZ(nextGame.cards, action.zone, action.zone === 'table' ? undefined : actor)
      if (action.faceUp !== undefined) card.faceUp = action.faceUp
      if (action.rotated !== undefined) card.rotated = action.rotated
      if (action.zone === 'hand') {
        card.rotated = false
      }
      if (action.zone === 'deck' || action.zone === 'discard') {
        card.order = getNextPileOrder(nextGame.cards, action.zone, actor)
        card.faceUp = action.zone === 'discard'
        card.rotated = false
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
      applyDeckOrder(nextGame.cards, actor, action.orderedCardIds)
      break
    }
    case 'complete_game': {
      completeCrawlv3Game(nextGame)
      break
    }
  }

  return nextGame
}
