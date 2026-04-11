import { doc, runTransaction } from 'firebase/firestore'

import { db } from '../lib/firebase.js'
import { verifyAuth } from '../lib/auth.js'

// We intentionally avoid importing from src/ to prevent tsconfig conflicts.
// The types are duplicated minimally here. The authoritative types live in src/types/.

type Player = 'player1' | 'player2'

interface PlayerInfo {
  uid: string
  username: string
}

interface DeckSelection {
  cardIds: number[]
  ready: boolean
}

interface GameState {
  cards: GameCard[]
  turn: number
  currentPlayer: Player
  player1HP: number
  player2HP: number
  player1AP: number
  player2AP: number
}

interface GameCard {
  gameId: string
  id: number
  name: string
  image: string
  atk?: number
  def?: number
  cost: number
  type?: string
  race?: string
  damage?: string
  effects?: EffectDef[]
  location: Location
  owner?: Player
  buffs: Record<string, string | number>
  debuffs: Record<string, string | number>
  faceUp?: boolean
  defensePosition?: boolean
  effectActivations?: Record<number, number>
  trapTriggers?: string[]
}

interface Location {
  id: string
  type: string
  index: number
  player: Player | null
  name: string | null
}

interface EffectDef {
  trigger?: string
  effect: string
  conditions?: unknown[]
  uses?: number
  activations?: number
  [key: string]: unknown
}

interface PendingReaction {
  id: string
  type: string
  respondingPlayer: Player
  triggerAction: GameAction
  eligibleCards: string[]
  timeout: number
}

interface CrawlV2Game {
  _version: number
  code: number | null
  status: 'lobby' | 'active' | 'finished'
  winner?: Player | null
  players: { player1: PlayerInfo | null; player2: PlayerInfo | null }
  decks: { player1: DeckSelection | null; player2: DeckSelection | null }
  gameState: GameState
  pendingReaction: PendingReaction | null
  processedActions: string[]
}

type GameAction =
  | { type: 'select_deck'; cardIds: number[]; actionId: string }
  | { type: 'ready_up'; actionId: string }
  | {
      type: 'summon_unit'
      cardGameId: string
      zoneId: string
      cost?: number
      atk?: number
      def?: number
      damage?: string
      actionId: string
    }
  | { type: 'set_trap'; cardGameId: string; zoneId: string; cost?: number; trapTriggers?: string[]; actionId: string }
  | {
      type: 'set_power'
      cardGameId: string
      zoneId: string
      cost?: number
      atk?: number
      def?: number
      damage?: string
      actionId: string
    }
  | {
      type: 'attack'
      sourceGameId: string
      targetGameId: string
      effectIndex?: number
      maxUses?: number
      actionId: string
    }
  | { type: 'direct_attack'; sourceGameId: string; effectIndex?: number; maxUses?: number; actionId: string }
  | {
      type: 'activate_effect'
      cardGameId: string
      effectIndex: number
      targets?: string[]
      effectType: string
      effectOptions?: Record<string, unknown>
      spentOnUse?: boolean
      maxUses?: number
      actionId: string
    }
  | { type: 'sacrifice'; cardGameId: string; cost?: number; actionId: string }
  | { type: 'swap_stance'; cardGameId: string; effectIndex?: number; maxUses?: number; actionId: string }
  | { type: 'end_turn'; actionId: string }
  | {
      type: 'update_card_buffs'
      updates: { gameId: string; buffs: Record<string, string | number>; debuffs: Record<string, string | number> }[]
      actionId: string
    }
  | {
      type: 'react'
      reactionId: string
      activate: boolean
      cardGameId?: string
      trapEffectType?: string
      targets?: string[]
      actionId: string
    }

// ─── Minimal game logic for server-side validation/resolution ────────────────

const BOARD_LOCATIONS: { id: string; type: string; player: Player | null }[] = [
  // Unit zones
  { id: 'unit11', type: 'unit', player: 'player1' },
  { id: 'unit12', type: 'unit', player: 'player1' },
  { id: 'unit13', type: 'unit', player: 'player1' },
  { id: 'unit14', type: 'unit', player: 'player1' },
  { id: 'unit15', type: 'unit', player: 'player1' },
  { id: 'unit16', type: 'unit', player: 'player1' },
  { id: 'unit21', type: 'unit', player: 'player2' },
  { id: 'unit22', type: 'unit', player: 'player2' },
  { id: 'unit23', type: 'unit', player: 'player2' },
  { id: 'unit24', type: 'unit', player: 'player2' },
  { id: 'unit25', type: 'unit', player: 'player2' },
  { id: 'unit26', type: 'unit', player: 'player2' },
  // Trap zones
  { id: 'trap11', type: 'trap', player: 'player1' },
  { id: 'trap12', type: 'trap', player: 'player1' },
  { id: 'trap13', type: 'trap', player: 'player1' },
  { id: 'trap21', type: 'trap', player: 'player2' },
  { id: 'trap22', type: 'trap', player: 'player2' },
  { id: 'trap23', type: 'trap', player: 'player2' },
  // Power zones
  { id: 'power11', type: 'power', player: 'player1' },
  { id: 'power12', type: 'power', player: 'player1' },
  { id: 'power13', type: 'power', player: 'player1' },
  { id: 'power14', type: 'power', player: 'player1' },
  { id: 'power21', type: 'power', player: 'player2' },
  { id: 'power22', type: 'power', player: 'player2' },
  { id: 'power23', type: 'power', player: 'player2' },
  { id: 'power24', type: 'power', player: 'player2' },
  // Hand zones
  ...Array.from({ length: 7 }, (_, i) => ({ id: `hand1${i + 1}`, type: 'hand', player: 'player1' as Player })),
  ...Array.from({ length: 7 }, (_, i) => ({ id: `hand2${i + 1}`, type: 'hand', player: 'player2' as Player })),
  // Deck/spent/dead
  { id: 'deck1', type: 'deck', player: 'player1' },
  { id: 'deck2', type: 'deck', player: 'player2' },
  { id: 'spent1', type: 'spent', player: 'player1' },
  { id: 'spent2', type: 'spent', player: 'player2' },
]

function getOpponent(player: Player): Player {
  return player === 'player1' ? 'player2' : 'player1'
}

const ATTACK_TARGET_BEHIND_ZONES: Partial<Record<string, string>> = {
  unit11: 'unit14',
  unit12: 'unit15',
  unit13: 'unit16',
  unit24: 'unit21',
  unit25: 'unit22',
  unit26: 'unit23',
}

function isBlinded(card: GameCard): boolean {
  return typeof card.debuffs.blind === 'number' && card.debuffs.blind > 0
}

function isEvasive(card: GameCard): boolean {
  return typeof card.buffs.evasive === 'number' && card.buffs.evasive > 0
}

function getValidAttackTargets(gs: GameState, player: Player): GameCard[] {
  return gs.cards.filter((card) => {
    if (card.owner !== getOpponent(player)) return false
    if (card.location.type !== 'unit') return false
    if (isEvasive(card)) return false

    const behindZoneId = ATTACK_TARGET_BEHIND_ZONES[card.location.id]
    return !behindZoneId || !gs.cards.some((candidate) => candidate.location.id === behindZoneId)
  })
}

function pickRandomTarget(validTargets: GameCard[]): GameCard {
  return validTargets[Math.floor(Math.random() * validTargets.length)]
}

function findCard(gs: GameState, gameId: string): GameCard | undefined {
  return gs.cards.find((c) => c.gameId === gameId)
}

function getPlayerAP(gs: GameState, player: Player): number {
  return player === 'player1' ? gs.player1AP : gs.player2AP
}

function deductAP(gs: GameState, card: GameCard): void {
  if (card.owner === 'player1') gs.player1AP -= card.cost
  else if (card.owner === 'player2') gs.player2AP -= card.cost
}

function addAP(gs: GameState, card: GameCard, amount = card.cost): void {
  if (card.owner === 'player1') gs.player1AP += amount
  else if (card.owner === 'player2') gs.player2AP += amount
}

function applyDamage(gs: GameState, player: Player, amount: number): void {
  if (player === 'player1') gs.player1HP -= amount
  else gs.player2HP -= amount
}

function spendCard(card: GameCard): void {
  card.location = {
    id: card.owner === 'player1' ? 'spent1' : 'spent2',
    type: 'spent',
    index: 1,
    player: card.owner ?? null,
    name: 'Spent',
  }
  card.faceUp = true
  card.defensePosition = false
  card.buffs = {}
  card.debuffs = {}
}

function getEffectiveAtk(card: GameCard): number {
  let atk = card.atk ?? 0
  for (const [key, val] of Object.entries(card.buffs)) {
    const stripped = key.split(':').slice(1).join(':') || key
    if (stripped === 'empower' && typeof val === 'number') atk += val
  }
  for (const [key, val] of Object.entries(card.debuffs)) {
    const stripped = key.split(':').slice(1).join(':') || key
    if (stripped === 'weak' && typeof val === 'number') atk -= val
  }
  return atk
}

function getEffectiveDef(card: GameCard): number {
  let def = card.def ?? 0
  for (const [key, val] of Object.entries(card.buffs)) {
    const stripped = key.split(':').slice(1).join(':') || key
    if (stripped === 'shield' && typeof val === 'number') def += val
  }
  return def
}

const TYPE_EFFECTIVENESS: Record<string, string[]> = {
  cosmic: ['necrotic', 'psychic', 'physical'],
  psychic: ['necrotic', 'fire'],
  necrotic: ['psychic', 'magic'],
  fire: ['physical'],
  physical: ['magic'],
  magic: ['fire'],
}

function getTypeEffectiveAtk(source: GameCard, target: GameCard): number {
  const atk = getEffectiveAtk(source)
  const srcType = source.damage
  const tgtType = target.damage
  if (srcType && tgtType && TYPE_EFFECTIVENESS[srcType]?.includes(tgtType)) {
    return Math.floor(atk * 1.25)
  }
  return atk
}

function resolveCombat(gs: GameState, source: GameCard, target: GameCard): void {
  // Burn: attacker takes 1 damage per burn stack
  const burnAmount = source.debuffs.burn
  if (typeof burnAmount === 'number' && burnAmount > 0 && source.owner) {
    applyDamage(gs, source.owner, 1)
  }

  const srcAtk = getTypeEffectiveAtk(source, target)

  if (target.defensePosition) {
    const tgtDef = getEffectiveDef(target)
    if (srcAtk >= tgtDef) {
      spendCard(target)
      if (source.buffs.piercing && typeof source.buffs.piercing === 'number') {
        const piercing = srcAtk - tgtDef
        if (piercing > 0 && target.owner) applyDamage(gs, target.owner, piercing)
      }
    } else if (source.owner) {
      applyDamage(gs, source.owner, tgtDef - srcAtk)
    }
  } else {
    const tgtAtk = getTypeEffectiveAtk(target, source)
    if (srcAtk > tgtAtk) {
      spendCard(target)
      if (target.owner) applyDamage(gs, target.owner, srcAtk - tgtAtk)
    } else if (tgtAtk > srcAtk) {
      spendCard(source)
      if (source.owner) applyDamage(gs, source.owner, tgtAtk - srcAtk)
    } else {
      spendCard(source)
      spendCard(target)
    }
  }
}

function trackActivation(card: GameCard, effectIndex?: number, maxUses?: number): string | null {
  if (effectIndex === undefined) return null
  if (!card.effectActivations) card.effectActivations = {}
  const count = card.effectActivations[effectIndex] ?? 0
  if (maxUses !== undefined && count >= maxUses) return 'Effect uses exhausted'
  card.effectActivations[effectIndex] = count + 1
  return null
}

function applyEffect(gs: GameState, card: GameCard, effect: EffectDef, targets: GameCard[]): void {
  const effectType = effect.effect
  const options = (effect as Record<string, unknown>).options as Record<string, unknown> | undefined

  switch (effectType) {
    case 'buff': {
      const buffs = (options?.buffs ?? []) as { key?: string; count?: number }[]
      for (const { key, count } of buffs) {
        if (!key || !count) continue
        for (const target of targets) {
          // Cursed blocks buff application and consumes a stack
          if (typeof target.debuffs.cursed === 'number' && target.debuffs.cursed > 0) {
            target.debuffs.cursed -= 1
            if (target.debuffs.cursed <= 0) delete target.debuffs.cursed
            continue
          }
          const current = (target.buffs[key] as number) || 0
          target.buffs[key] = current + count
        }
      }
      break
    }
    case 'debuff': {
      const debuffs = (options?.debuffs ?? []) as { key?: string; count?: number }[]
      for (const { key, count } of debuffs) {
        if (!key || !count) continue
        for (const target of targets) {
          // Cleanse blocks debuff application and consumes a stack
          if (typeof target.buffs.cleanse === 'number' && target.buffs.cleanse > 0) {
            target.buffs.cleanse -= 1
            if (target.buffs.cleanse <= 0) delete target.buffs.cleanse
            continue
          }
          const current = (target.debuffs[key] as number) || 0
          target.debuffs[key] = current + count
          // Cursed clears all buffs on application
          if (key === 'cursed') {
            target.buffs = {}
          }
        }
      }
      break
    }
    case 'direct_damage': {
      const amount = (options?.amount as number) ?? 0
      if (!amount) break
      const dmgTarget = options?.target as string | undefined
      const player = dmgTarget === 'opponent' ? (card.owner === 'player1' ? 'player2' : 'player1') : card.owner
      if (player) applyDamage(gs, player, amount)
      break
    }
    case 'swap_positions': {
      if (targets.length >= 2) {
        const loc0 = { ...targets[0].location }
        const loc1 = { ...targets[1].location }
        targets[0].location = loc1
        targets[1].location = loc0
      }
      break
    }
    case 'flip_card': {
      for (const target of targets) {
        target.faceUp = !target.faceUp
      }
      break
    }
    case 'move_card': {
      const destination = (options?.destination as string) ?? 'hand'
      for (const target of targets) {
        if (destination === 'hand') {
          target.location = {
            id: target.owner === 'player1' ? 'hand1' : 'hand2',
            type: 'hand',
            index: 0,
            player: target.owner ?? null,
            name: 'Hand',
          }
          target.faceUp = true
          target.buffs = {}
          target.debuffs = {}
        } else if (destination === 'spent') {
          spendCard(target)
        } else if (destination === 'dead') {
          target.location = {
            id: target.owner === 'player1' ? 'dead1' : 'dead2',
            type: 'dead',
            index: 0,
            player: target.owner ?? null,
            name: 'Dead',
          }
          target.faceUp = true
          target.buffs = {}
          target.debuffs = {}
        } else if (destination === 'deck') {
          target.location = {
            id: target.owner === 'player1' ? 'deck1' : 'deck2',
            type: 'deck',
            index: 0,
            player: target.owner ?? null,
            name: 'Deck',
          }
          target.faceUp = false
          target.buffs = {}
          target.debuffs = {}
        }
      }
      break
    }
    case 'gain_ap': {
      const amount = (options?.amount as number) ?? 0
      if (!amount || !card.owner) break
      if (card.owner === 'player1') gs.player1AP += amount
      else gs.player2AP += amount
      break
    }
    case 'damage_type': {
      const dmgType = (options?.damageType as string) ?? ''
      for (const target of targets) {
        target.buffs['damage'] = dmgType
      }
      break
    }
    // negate handlers are only relevant in event contexts (traps), skip here
    default:
      break
  }
}

function drawCardForPlayer(gs: GameState, player: Player): void {
  const deckCards = gs.cards
    .filter((c) => c.location.type === 'deck' && c.owner === player)
    .sort((a, b) => b.location.index - a.location.index)

  if (deckCards.length === 0) {
    // Reshuffle spent pile
    const spentCards = gs.cards.filter((c) => c.location.type === 'spent' && c.owner === player)
    for (const c of spentCards) {
      c.location = { id: player === 'player1' ? 'deck1' : 'deck2', type: 'deck', index: 0, player, name: 'Deck' }
      c.faceUp = false
      c.buffs = {}
      c.debuffs = {}
    }
    // Shuffle
    const newDeck = gs.cards.filter((c) => c.location.type === 'deck' && c.owner === player)
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]]
    }
    for (let i = 0; i < newDeck.length; i++) newDeck[i].location.index = i
    return drawCardForPlayer(gs, player)
  }

  const card = deckCards[0]
  const handSlot = BOARD_LOCATIONS.find(
    (loc) => loc.type === 'hand' && loc.player === player && !gs.cards.some((c) => c.location.id === loc.id),
  )
  if (!handSlot) return

  card.faceUp = true
  card.location = { id: handSlot.id, type: 'hand', index: 0, player, name: 'Hand' }
}

function applyEndTurn(gs: GameState): void {
  const next = getOpponent(gs.currentPlayer)
  if (gs.currentPlayer === 'player2') gs.turn++
  gs.currentPlayer = next

  if (next === 'player1') gs.player1AP = 2
  else gs.player2AP = 2

  // Reset effect activations for all cards (attack 1/turn, stance 1/turn, etc.)
  for (const card of gs.cards) {
    if (card.effectActivations) card.effectActivations = {}
  }

  // Decrement burn on the new player's units
  for (const card of gs.cards) {
    if (card.owner !== next) continue
    if (typeof card.debuffs.burn !== 'number') continue
    card.debuffs.burn -= 1
    if (card.debuffs.burn <= 0) delete card.debuffs.burn
  }

  // Spend hand cards (except retained)
  const handCards = gs.cards.filter((c) => c.location.type === 'hand' && c.owner === next)
  for (const card of handCards) {
    if (typeof card.buffs.retain === 'number' && card.buffs.retain > 0) {
      card.buffs.retain -= 1
      if (card.buffs.retain <= 0) delete card.buffs.retain
    } else {
      spendCard(card)
    }
  }

  for (let i = 0; i < 4; i++) drawCardForPlayer(gs, next)
}

// ─── Deck initialization (using card database on the client) ──────────────────
// Server trusts the client's card IDs and creates minimal GameCards.
// The full card data (effects, images) is resolved client-side from the card database.

function initializeGameState(p1Ids: number[], p2Ids: number[]): GameState {
  let nextId = 0
  const makeCards = (ids: number[], owner: Player): GameCard[] =>
    ids.map((id, index) => ({
      gameId: String(nextId++),
      id,
      name: '',
      image: '',
      cost: 0,
      location: {
        id: owner === 'player1' ? 'deck1' : 'deck2',
        type: 'deck',
        index,
        player: owner,
        name: 'Deck',
      },
      owner,
      buffs: {},
      debuffs: {},
      faceUp: false,
      defensePosition: false,
    }))

  const gs: GameState = {
    turn: 1,
    currentPlayer: 'player1',
    player1HP: 40,
    player2HP: 40,
    player1AP: 2,
    player2AP: 0,
    cards: [...makeCards(p1Ids, 'player1'), ...makeCards(p2Ids, 'player2')],
  }

  // Shuffle both decks
  for (const player of ['player1', 'player2'] as Player[]) {
    const deck = gs.cards.filter((c) => c.location.type === 'deck' && c.owner === player)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    for (let i = 0; i < deck.length; i++) deck[i].location.index = i
  }

  // Draw initial hand for player1 only — player2 draws when their turn starts
  for (let i = 0; i < 4; i++) drawCardForPlayer(gs, 'player1')

  return gs
}

// ─── Reaction checking ──────────────────────────────────────────────────────

function checkForAttackReactions(game: CrawlV2Game, sourceId: string, targetId: string): PendingReaction | null {
  const defender = getOpponent(game.gameState.currentPlayer)
  const gs = game.gameState

  const eligible = gs.cards.filter((card) => {
    if (card.owner !== defender) return false
    if (card.location.type !== 'trap' || card.faceUp) return false
    return (card.trapTriggers ?? []).includes('attack_declared')
  })

  if (eligible.length === 0) return null

  return {
    id: `react_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'trap_activation',
    respondingPlayer: defender,
    triggerAction: { type: 'attack', sourceGameId: sourceId, targetGameId: targetId, actionId: '' },
    eligibleCards: eligible.map((c) => c.gameId),
    timeout: Date.now() + 30000,
  }
}

// ─── Action handlers ────────────────────────────────────────────────────────

type ActionResult = { success: boolean; error?: string }

function getPlayerKey(game: CrawlV2Game, uid: string): Player | null {
  if (game.players.player1?.uid === uid) return 'player1'
  if (game.players.player2?.uid === uid) return 'player2'
  return null
}

function handleLobbyAction(game: CrawlV2Game, action: GameAction, playerKey: Player): ActionResult {
  if (action.type === 'select_deck') {
    if (!action.cardIds?.length) return { success: false, error: 'No cards provided' }
    game.decks[playerKey] = { cardIds: action.cardIds, ready: false }
    return { success: true }
  }
  if (action.type === 'ready_up') {
    const deck = game.decks[playerKey]
    if (!deck?.cardIds?.length) return { success: false, error: 'Select a deck first' }
    deck.ready = true

    if (game.decks.player1?.ready && game.decks.player2?.ready && game.players.player1 && game.players.player2) {
      game.gameState = initializeGameState(game.decks.player1.cardIds, game.decks.player2.cardIds)
      game.status = 'active'
    }
    return { success: true }
  }
  return { success: false, error: 'Invalid action for lobby' }
}

function handleGameAction(game: CrawlV2Game, action: GameAction, playerKey: Player): ActionResult {
  const gs = game.gameState

  if (action.type === 'react') {
    const pending = game.pendingReaction
    if (!pending) return { success: false, error: 'No pending reaction' }
    if (pending.id !== action.reactionId) return { success: false, error: 'Stale reaction' }
    if (pending.respondingPlayer !== playerKey) return { success: false, error: 'Not your reaction window' }

    if (!action.activate) {
      game.pendingReaction = null
      if (pending.triggerAction.type === 'attack') {
        const src = findCard(gs, pending.triggerAction.sourceGameId)
        const tgt = findCard(gs, pending.triggerAction.targetGameId)
        if (src && tgt) resolveCombat(gs, src, tgt)
      }
      return { success: true }
    }

    // Activate trap
    if (action.cardGameId) {
      const trap = findCard(gs, action.cardGameId)
      if (!trap || !pending.eligibleCards.includes(action.cardGameId)) {
        return { success: false, error: 'Invalid trap card' }
      }
      trap.faceUp = true
      const isNegate = action.trapEffectType === 'negate_attack' || action.trapEffectType === 'negate_effect'
      spendCard(trap)

      if (!isNegate && pending.triggerAction.type === 'attack') {
        const src = findCard(gs, pending.triggerAction.sourceGameId)
        const tgt = findCard(gs, pending.triggerAction.targetGameId)
        if (src && tgt) resolveCombat(gs, src, tgt)
      }
    }

    game.pendingReaction = null
    return { success: true }
  }

  // Non-react actions require active turn
  if (gs.currentPlayer !== playerKey) return { success: false, error: 'Not your turn' }
  if (game.pendingReaction) return { success: false, error: 'Waiting for opponent reaction' }

  switch (action.type) {
    case 'end_turn': {
      applyEndTurn(gs)
      return { success: true }
    }
    case 'summon_unit': {
      const card = findCard(gs, action.cardGameId)
      if (!card) return { success: false, error: 'Card not found' }
      if (card.owner !== playerKey) return { success: false, error: 'Not your card' }
      if (card.location.type !== 'hand') return { success: false, error: 'Card not in hand' }
      const cost = action.cost ?? card.cost
      if (getPlayerAP(gs, playerKey) < cost) return { success: false, error: 'Not enough AP' }
      const zone = BOARD_LOCATIONS.find((l) => l.id === action.zoneId)
      if (!zone || zone.type !== 'unit' || zone.player !== playerKey) return { success: false, error: 'Invalid zone' }
      if (gs.cards.some((c) => c.location.id === action.zoneId)) return { success: false, error: 'Zone occupied' }
      card.cost = cost
      if (action.atk !== undefined) card.atk = action.atk
      if (action.def !== undefined) card.def = action.def
      if (action.damage) card.damage = action.damage
      deductAP(gs, card)
      card.location = { id: zone.id, type: zone.type, index: 0, player: zone.player, name: 'Unit' }
      card.faceUp = true
      return { success: true }
    }
    case 'set_trap': {
      const card = findCard(gs, action.cardGameId)
      if (!card) return { success: false, error: 'Card not found' }
      if (card.owner !== playerKey) return { success: false, error: 'Not your card' }
      if (card.location.type !== 'hand') return { success: false, error: 'Card not in hand' }
      const cost = action.cost ?? card.cost
      if (getPlayerAP(gs, playerKey) < cost) return { success: false, error: 'Not enough AP' }
      const zone = BOARD_LOCATIONS.find((l) => l.id === action.zoneId)
      if (!zone || zone.type !== 'trap' || zone.player !== playerKey) return { success: false, error: 'Invalid zone' }
      if (gs.cards.some((c) => c.location.id === action.zoneId)) return { success: false, error: 'Zone occupied' }
      card.cost = cost
      if (action.trapTriggers?.length) card.trapTriggers = action.trapTriggers
      deductAP(gs, card)
      card.location = { id: zone.id, type: zone.type, index: 0, player: zone.player, name: 'Trap' }
      card.faceUp = false
      return { success: true }
    }
    case 'set_power': {
      const card = findCard(gs, action.cardGameId)
      if (!card) return { success: false, error: 'Card not found' }
      if (card.owner !== playerKey) return { success: false, error: 'Not your card' }
      if (card.location.type !== 'hand') return { success: false, error: 'Card not in hand' }
      const cost = action.cost ?? card.cost
      if (getPlayerAP(gs, playerKey) < cost) return { success: false, error: 'Not enough AP' }
      const zone = BOARD_LOCATIONS.find((l) => l.id === action.zoneId)
      if (!zone || zone.type !== 'power' || zone.player !== playerKey) return { success: false, error: 'Invalid zone' }
      if (gs.cards.some((c) => c.location.id === action.zoneId)) return { success: false, error: 'Zone occupied' }
      card.cost = cost
      if (action.atk !== undefined) card.atk = action.atk
      if (action.def !== undefined) card.def = action.def
      if (action.damage) card.damage = action.damage
      deductAP(gs, card)
      card.location = { id: zone.id, type: zone.type, index: 0, player: zone.player, name: 'Power' }
      card.faceUp = true
      return { success: true }
    }
    case 'attack': {
      if (playerKey === 'player1' && gs.turn === 1) {
        return { success: false, error: 'Player 1 cannot attack on turn 1' }
      }
      const source = findCard(gs, action.sourceGameId)
      if (!source) return { success: false, error: 'Attacker not found' }
      if (source.owner !== playerKey) return { success: false, error: 'Not your card' }
      if (source.location.type !== 'unit') return { success: false, error: 'Attacker not on field' }
      if (source.defensePosition) return { success: false, error: 'Cannot attack in defense' }
      const atkErr = trackActivation(source, action.effectIndex, action.maxUses)
      if (atkErr) return { success: false, error: atkErr }

      const validTargets = getValidAttackTargets(gs, playerKey)
      if (!validTargets.length) return { success: false, error: 'No valid attack targets' }

      const target = isBlinded(source)
        ? pickRandomTarget(validTargets)
        : validTargets.find((card) => card.gameId === action.targetGameId)

      if (!target) return { success: false, error: 'Invalid target' }
      const resolvedAction = { ...action, targetGameId: target.gameId }

      const reaction = checkForAttackReactions(game, action.sourceGameId, target.gameId)
      if (reaction) {
        reaction.triggerAction = resolvedAction
        game.pendingReaction = reaction
        return { success: true }
      }
      resolveCombat(gs, source, target)
      return { success: true }
    }
    case 'sacrifice': {
      const card = findCard(gs, action.cardGameId)
      if (!card) return { success: false, error: 'Card not found' }
      if (card.owner !== playerKey) return { success: false, error: 'Not your card' }
      if (card.location.type !== 'unit') return { success: false, error: 'Card not on field' }
      if (action.cost !== undefined) card.cost = action.cost
      addAP(gs, card, 1)
      spendCard(card)
      return { success: true }
    }
    case 'swap_stance': {
      const card = findCard(gs, action.cardGameId)
      if (!card) return { success: false, error: 'Card not found' }
      if (card.owner !== playerKey) return { success: false, error: 'Not your card' }
      if (card.location.type !== 'unit') return { success: false, error: 'Card not on field' }
      const stanceErr = trackActivation(card, action.effectIndex, action.maxUses)
      if (stanceErr) return { success: false, error: stanceErr }
      card.defensePosition = !card.defensePosition
      return { success: true }
    }
    case 'direct_attack': {
      if (playerKey === 'player1' && gs.turn === 1) {
        return { success: false, error: 'Player 1 cannot attack on turn 1' }
      }
      const source = findCard(gs, action.sourceGameId)
      if (!source) return { success: false, error: 'Attacker not found' }
      if (source.owner !== playerKey) return { success: false, error: 'Not your card' }
      if (source.location.type !== 'unit') return { success: false, error: 'Attacker not on field' }
      if (source.defensePosition) return { success: false, error: 'Cannot attack in defense' }
      const directErr = trackActivation(source, action.effectIndex, action.maxUses)
      if (directErr) return { success: false, error: directErr }
      // Verify no opponent units exist
      const opponent = playerKey === 'player1' ? 'player2' : 'player1'
      const oppUnits = gs.cards.filter((c) => c.owner === opponent && c.location.type === 'unit')
      if (oppUnits.length > 0) return { success: false, error: 'Opponent has units on field' }
      const dmg = getEffectiveAtk(source)
      applyDamage(gs, opponent, dmg)
      return { success: true }
    }
    case 'activate_effect': {
      const card = findCard(gs, action.cardGameId)
      if (!card) return { success: false, error: 'Card not found' }
      if (card.owner !== playerKey) return { success: false, error: 'Not your card' }

      // Track activations in a card-level map (server cards may lack full effect defs)
      if (!card.effectActivations) card.effectActivations = {}
      const activationCount = card.effectActivations[action.effectIndex] ?? 0
      if (action.maxUses !== undefined && activationCount >= action.maxUses) {
        return { success: false, error: 'Effect uses exhausted' }
      }
      card.effectActivations[action.effectIndex] = activationCount + 1

      // Apply effect using client-provided type/options
      const targets = (action.targets ?? []).map((id) => findCard(gs, id)).filter(Boolean) as GameCard[]
      const clientEffect: EffectDef = {
        effect: action.effectType,
        ...(action.effectOptions ? { options: action.effectOptions } : {}),
      } as EffectDef
      applyEffect(gs, card, clientEffect, targets)

      if (action.spentOnUse) spendCard(card)
      return { success: true }
    }
    case 'update_card_buffs': {
      for (const upd of action.updates) {
        const card = findCard(gs, upd.gameId)
        if (!card) continue
        card.buffs = upd.buffs
        card.debuffs = upd.debuffs
      }
      return { success: true }
    }
    default:
      return { success: false, error: 'Unknown action type' }
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

const handler = async (event: { body: string; headers: Record<string, string> }) => {
  try {
    const authResult = await verifyAuth(event)
    if (authResult.error) return authResult.error

    const body = JSON.parse(event.body) as { gameId: string; action: GameAction }
    const { gameId, action } = body

    if (!gameId || !action) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'gameId and action are required' }),
      }
    }

    const docRef = doc(db, 'crawlv2_games', gameId)
    let result: ActionResult = { success: false, error: 'Unknown error' }

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef)
      if (!snap.exists()) {
        result = { success: false, error: 'Game not found' }
        return
      }

      const game = snap.data() as CrawlV2Game

      if (game.processedActions.includes(action.actionId)) {
        result = { success: true }
        return
      }

      const playerKey = getPlayerKey(game, authResult.auth.uid)
      if (!playerKey) {
        result = { success: false, error: 'Not a player in this game' }
        return
      }

      if (game.status === 'lobby') {
        result = handleLobbyAction(game, action, playerKey)
      } else if (game.status === 'active') {
        result = handleGameAction(game, action, playerKey)
      } else {
        result = { success: false, error: 'Game is finished' }
        return
      }

      if (!result.success) return

      game.processedActions.push(action.actionId)
      if (game.processedActions.length > 50) game.processedActions.shift()

      if (game.status === 'active') {
        if (game.gameState.player1HP <= 0) {
          game.status = 'finished'
          game.winner = 'player2'
        } else if (game.gameState.player2HP <= 0) {
          game.status = 'finished'
          game.winner = 'player1'
        }
      }

      game._version = (game._version ?? 0) + 1
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
      body: JSON.stringify({ success: true }),
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
