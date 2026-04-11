import type { GameCard } from '../../types/cards.js'
import type { GameState } from '../../types/crawlv2.js'
import { locations } from '../../types/crawlv2.js'
import { convertToGameCard } from '../../types/defaultGameState.js'
import type { CrawlV2Game, GameAction, PendingReaction, Player } from '../../types/crawlv2-multiplayer.js'
import { evaluateConditions, filterByTargets } from './check-system.js'
import { getEffective } from './buff-system.js'
import { getTypeEffectiveAtk } from './damage-types.js'
import { drawCardForPlayerPure, shuffleDeckPure, spendCardPure } from './card-movement.js'
import { v4 as uuid } from 'uuid'
import { Event } from '../../types/events.js'

export interface ActionResult {
  success: boolean
  error?: string
  pendingReaction?: PendingReaction
}

function getOpponent(player: Player): Player {
  return player === 'player1' ? 'player2' : 'player1'
}

function isBlinded(card: GameCard): boolean {
  return typeof card.debuffs.blind === 'number' && card.debuffs.blind > 0
}

function isEvasive(card: GameCard): boolean {
  return typeof card.buffs.evasive === 'number' && card.buffs.evasive > 0
}

function getFallbackAttackTargets(gs: GameState, source: GameCard): GameCard[] {
  return gs.cards.filter((card) => {
    if (card.owner !== getOpponent(source.owner!)) return false
    if (card.location.type !== 'unit') return false
    if (isEvasive(card)) return false

    const behind = card.location.behind ?? []
    return !behind.some((id) => gs.cards.some((candidate) => candidate.location.id === id))
  })
}

function getValidAttackTargets(gs: GameState, source: GameCard, effectIndex?: number): GameCard[] {
  const attackEffect =
    effectIndex !== undefined
      ? source.effects?.[effectIndex]
      : source.effects?.find((effect) => effect.trigger === 'manual' && effect.effect === 'damage')

  if (!attackEffect?.targets?.length) {
    return getFallbackAttackTargets(gs, source)
  }

  return filterByTargets(attackEffect.targets, source, gs).filter((card) => !isEvasive(card))
}

function pickRandomTarget(validTargets: GameCard[]): GameCard {
  return validTargets[Math.floor(Math.random() * validTargets.length)]
}

function findCard(gs: GameState, gameId: string): GameCard | undefined {
  return gs.cards.find((c) => c.gameId === gameId)
}

function deductAP(gs: GameState, card: GameCard): void {
  if (card.owner === 'player1') gs.player1AP -= card.cost
  else if (card.owner === 'player2') gs.player2AP -= card.cost
}

function addAP(gs: GameState, card: GameCard, amount = card.cost): void {
  if (card.owner === 'player1') gs.player1AP += amount
  else if (card.owner === 'player2') gs.player2AP += amount
}

function getPlayerAP(gs: GameState, player: Player): number {
  return player === 'player1' ? gs.player1AP : gs.player2AP
}

function applyDamageToPlayer(gs: GameState, player: Player, amount: number): void {
  if (player === 'player1') gs.player1HP -= amount
  else gs.player2HP -= amount
}

/**
 * Check if the defending player has traps that could react to an attack.
 */
function checkForAttackReactions(
  game: CrawlV2Game,
  sourceCard: GameCard,
  targetCard: GameCard,
): PendingReaction | null {
  const defender = getOpponent(game.gameState.currentPlayer)
  const gs = game.gameState

  const eligible = gs.cards.filter((card) => {
    if (card.owner !== defender) return false
    if (card.location.type !== 'trap' || card.faceUp) return false

    return (card.effects ?? []).some((effect) => {
      if (effect.trigger !== Event.ATTACK_DECLARED) return false
      return evaluateConditions(
        effect.conditions,
        card,
        gs,
        targetCard, // event target
        sourceCard, // event source
      )
    })
  })

  if (eligible.length === 0) return null

  return {
    id: uuid(),
    type: 'trap_activation',
    respondingPlayer: defender,
    triggerAction: { type: 'attack', sourceGameId: sourceCard.gameId, targetGameId: targetCard.gameId, actionId: '' },
    eligibleCards: eligible.map((c) => c.gameId),
    timeout: Date.now() + 30000,
  }
}

/**
 * Resolve combat between attacker and defender.
 */
function resolveCombat(gs: GameState, source: GameCard, target: GameCard): void {
  const srcAtk = getTypeEffectiveAtk(source, target)
  if (!srcAtk) return

  if (target.defensePosition) {
    const tgtDef = getEffective(target).def ?? 0
    if (srcAtk >= tgtDef) {
      // Destroy defender
      spendCardPure(target)
      if (source.buffs.piercing && typeof source.buffs.piercing === 'number') {
        const piercing = srcAtk - tgtDef
        if (piercing > 0 && target.owner) {
          applyDamageToPlayer(gs, target.owner, piercing)
        }
      }
    } else {
      // Reflect damage to attacker's owner
      const reflect = tgtDef - srcAtk
      if (source.owner) {
        applyDamageToPlayer(gs, source.owner, reflect)
      }
    }
  } else {
    const tgtAtk = getTypeEffectiveAtk(target, source)
    if (srcAtk > tgtAtk) {
      spendCardPure(target)
      if (target.owner) {
        applyDamageToPlayer(gs, target.owner, srcAtk - tgtAtk)
      }
    } else if (tgtAtk > srcAtk) {
      spendCardPure(source)
      if (source.owner) {
        applyDamageToPlayer(gs, source.owner, tgtAtk - srcAtk)
      }
    } else {
      // Both destroyed on tie
      spendCardPure(source)
      spendCardPure(target)
    }
  }
}

/**
 * Apply the end-of-turn / start-of-turn logic.
 */
function applyEndTurn(gs: GameState): void {
  const current = gs.currentPlayer
  const next = getOpponent(current)

  if (current === 'player2') gs.turn++
  gs.currentPlayer = next

  // Grant AP
  if (next === 'player1') gs.player1AP = 2
  else gs.player2AP = 2

  // Spend hand cards (except retained)
  const handCards = gs.cards.filter((c) => c.location.type === 'hand' && c.owner === next)
  for (const card of handCards) {
    if (typeof card.buffs.retain === 'number' && card.buffs.retain > 0) {
      card.buffs.retain -= 1
      if (card.buffs.retain <= 0) delete card.buffs.retain
    } else {
      spendCardPure(card)
    }
  }

  // Draw 4 cards
  for (let i = 0; i < 4; i++) {
    drawCardForPlayerPure(gs, next)
  }
}

/**
 * Main action resolver. Validates and applies a game action.
 * Returns the result (success/error and optional pending reaction).
 */
export function resolveAction(game: CrawlV2Game, action: GameAction, callerPlayer: Player): ActionResult {
  const gs = game.gameState

  // Handle react action separately (can come from non-active player)
  if (action.type === 'react') {
    return resolveReaction(game, action)
  }

  // All other actions require being the active player
  if (gs.currentPlayer !== callerPlayer) {
    return { success: false, error: 'Not your turn' }
  }

  // Cannot act while a reaction is pending
  if (game.pendingReaction) {
    return { success: false, error: 'Waiting for opponent reaction' }
  }

  switch (action.type) {
    case 'summon_unit':
      return resolveSummon(gs, action, callerPlayer)
    case 'set_trap':
      return resolveSetTrap(gs, action, callerPlayer)
    case 'set_power':
      return resolveSetPower(gs, action, callerPlayer)
    case 'attack':
      return resolveAttack(game, action, callerPlayer)
    case 'sacrifice':
      return resolveSacrifice(gs, action, callerPlayer)
    case 'swap_stance':
      return resolveSwapStance(gs, action, callerPlayer)
    case 'activate_effect':
      return resolveActivateEffect(gs, action, callerPlayer)
    case 'end_turn':
      applyEndTurn(gs)
      return { success: true }
    default:
      return { success: false, error: 'Unknown action type' }
  }
}

function resolveSummon(
  gs: GameState,
  action: Extract<GameAction, { type: 'summon_unit' }>,
  player: Player,
): ActionResult {
  const card = findCard(gs, action.cardGameId)
  if (!card) return { success: false, error: 'Card not found' }
  if (card.owner !== player) return { success: false, error: 'Not your card' }
  if (card.location.type !== 'hand') return { success: false, error: 'Card not in hand' }
  if (getPlayerAP(gs, player) < card.cost) return { success: false, error: 'Not enough AP' }

  const zone = locations.find((l) => l.id === action.zoneId)
  if (!zone) return { success: false, error: 'Invalid zone' }
  if (zone.type !== 'unit' || zone.player !== player) return { success: false, error: 'Invalid zone for summon' }
  if (gs.cards.some((c) => c.location.id === action.zoneId)) return { success: false, error: 'Zone occupied' }

  deductAP(gs, card)
  card.location = zone
  card.faceUp = true

  return { success: true }
}

function resolveSetTrap(
  gs: GameState,
  action: Extract<GameAction, { type: 'set_trap' }>,
  player: Player,
): ActionResult {
  const card = findCard(gs, action.cardGameId)
  if (!card) return { success: false, error: 'Card not found' }
  if (card.owner !== player) return { success: false, error: 'Not your card' }
  if (card.location.type !== 'hand') return { success: false, error: 'Card not in hand' }
  if (card.type !== 'trap') return { success: false, error: 'Card is not a trap' }
  if (getPlayerAP(gs, player) < card.cost) return { success: false, error: 'Not enough AP' }

  const zone = locations.find((l) => l.id === action.zoneId)
  if (!zone) return { success: false, error: 'Invalid zone' }
  if (zone.type !== 'trap' || zone.player !== player) return { success: false, error: 'Invalid trap zone' }
  if (gs.cards.some((c) => c.location.id === action.zoneId)) return { success: false, error: 'Zone occupied' }

  deductAP(gs, card)
  card.location = zone
  card.faceUp = false

  return { success: true }
}

function resolveSetPower(
  gs: GameState,
  action: Extract<GameAction, { type: 'set_power' }>,
  player: Player,
): ActionResult {
  const card = findCard(gs, action.cardGameId)
  if (!card) return { success: false, error: 'Card not found' }
  if (card.owner !== player) return { success: false, error: 'Not your card' }
  if (card.location.type !== 'hand') return { success: false, error: 'Card not in hand' }
  if (card.type !== 'power') return { success: false, error: 'Card is not a power' }
  if (getPlayerAP(gs, player) < card.cost) return { success: false, error: 'Not enough AP' }

  const zone = locations.find((l) => l.id === action.zoneId)
  if (!zone) return { success: false, error: 'Invalid zone' }
  if (zone.type !== 'power' || zone.player !== player) return { success: false, error: 'Invalid power zone' }
  if (gs.cards.some((c) => c.location.id === action.zoneId)) return { success: false, error: 'Zone occupied' }

  deductAP(gs, card)
  card.location = zone
  card.faceUp = false

  return { success: true }
}

function resolveAttack(
  game: CrawlV2Game,
  action: Extract<GameAction, { type: 'attack' }>,
  player: Player,
): ActionResult {
  const gs = game.gameState
  if (player === 'player1' && gs.turn === 1) {
    return { success: false, error: 'Player 1 cannot attack on turn 1' }
  }
  const source = findCard(gs, action.sourceGameId)

  if (!source) return { success: false, error: 'Attacker not found' }
  if (source.owner !== player) return { success: false, error: 'Not your card' }
  if (source.location.type !== 'unit') return { success: false, error: 'Attacker not on field' }
  if (source.defensePosition) return { success: false, error: 'Cannot attack in defense position' }

  const validTargets = getValidAttackTargets(gs, source, action.effectIndex)
  if (!validTargets.length) return { success: false, error: 'No valid attack targets' }

  const target = isBlinded(source)
    ? pickRandomTarget(validTargets)
    : validTargets.find((card) => card.gameId === action.targetGameId)

  if (!target) return { success: false, error: 'Invalid target' }
  const resolvedAction = { ...action, targetGameId: target.gameId }

  // Check for trap reactions before resolving combat
  const reaction = checkForAttackReactions(game, source, target)
  if (reaction) {
    reaction.triggerAction = resolvedAction
    game.pendingReaction = reaction
    return { success: true, pendingReaction: reaction }
  }

  // No reactions — resolve combat immediately
  resolveCombat(gs, source, target)
  return { success: true }
}

function resolveSacrifice(
  gs: GameState,
  action: Extract<GameAction, { type: 'sacrifice' }>,
  player: Player,
): ActionResult {
  const card = findCard(gs, action.cardGameId)
  if (!card) return { success: false, error: 'Card not found' }
  if (card.owner !== player) return { success: false, error: 'Not your card' }
  if (card.location.type !== 'unit') return { success: false, error: 'Card not on field' }

  addAP(gs, card, 1)
  spendCardPure(card)

  return { success: true }
}

function resolveSwapStance(
  gs: GameState,
  action: Extract<GameAction, { type: 'swap_stance' }>,
  player: Player,
): ActionResult {
  const card = findCard(gs, action.cardGameId)
  if (!card) return { success: false, error: 'Card not found' }
  if (card.owner !== player) return { success: false, error: 'Not your card' }
  if (card.location.type !== 'unit') return { success: false, error: 'Card not on field' }

  card.defensePosition = !card.defensePosition

  return { success: true }
}

function resolveActivateEffect(
  gs: GameState,
  action: Extract<GameAction, { type: 'activate_effect' }>,
  player: Player,
): ActionResult {
  const card = findCard(gs, action.cardGameId)
  if (!card) return { success: false, error: 'Card not found' }
  if (card.owner !== player) return { success: false, error: 'Not your card' }

  const effect = card.effects?.[action.effectIndex]
  if (!effect) return { success: false, error: 'Effect not found' }
  if (effect.trigger !== 'manual') return { success: false, error: 'Effect is not manually activated' }

  const maxUses = effect.uses
  if (maxUses !== undefined && (effect.activations ?? 0) >= maxUses) {
    return { success: false, error: 'Effect uses exhausted' }
  }

  // Evaluate conditions
  if (!evaluateConditions(effect.conditions, card, gs)) {
    return { success: false, error: 'Conditions not met' }
  }

  // Validate targets if provided
  if (action.targets?.length && effect.targets?.length) {
    const validTargets = filterByTargets(effect.targets, card, gs)
    const validIds = new Set(validTargets.map((t) => t.gameId))
    for (const targetId of action.targets) {
      if (!validIds.has(targetId)) {
        return { success: false, error: 'Invalid target' }
      }
    }
  }

  // Track activation
  if (effect.activations === undefined) effect.activations = 0
  effect.activations++

  return { success: true }
}

function resolveReaction(
  game: CrawlV2Game,
  action: Extract<GameAction, { type: 'react' }>,
): ActionResult {
  const pending = game.pendingReaction
  if (!pending) return { success: false, error: 'No pending reaction' }
  if (pending.id !== action.reactionId) return { success: false, error: 'Stale reaction' }

  const gs = game.gameState

  if (!action.activate) {
    // Declined — resolve the original action
    game.pendingReaction = null

    if (pending.triggerAction.type === 'attack') {
      const source = findCard(gs, pending.triggerAction.sourceGameId)
      const target = findCard(gs, pending.triggerAction.targetGameId)
      if (source && target) {
        resolveCombat(gs, source, target)
      }
    }

    return { success: true }
  }

  // Activated trap
  if (action.cardGameId) {
    const trapCard = findCard(gs, action.cardGameId)
    if (!trapCard) return { success: false, error: 'Trap card not found' }
    if (!pending.eligibleCards.includes(action.cardGameId)) {
      return { success: false, error: 'Card not eligible for reaction' }
    }

    // Flip trap face up and spend it
    trapCard.faceUp = true
    spendCardPure(trapCard)

    // For negate effects, the original attack is cancelled (combat not resolved)
    // For non-negate effects, resolve the original attack after trap
    const isNegate = trapCard.effects?.some(
      (e) => e.trigger === Event.ATTACK_DECLARED && (e.effect === 'negate_attack' || e.effect === 'negate_effect'),
    )

    if (!isNegate && pending.triggerAction.type === 'attack') {
      const source = findCard(gs, pending.triggerAction.sourceGameId)
      const target = findCard(gs, pending.triggerAction.targetGameId)
      if (source && target) {
        resolveCombat(gs, source, target)
      }
    }
  }

  game.pendingReaction = null
  return { success: true }
}

/**
 * Initialize a game from deck selections.
 */
export function initializeGameState(
  player1CardIds: number[],
  player2CardIds: number[],
): GameState {
  let nextGameId = 0
  const p1Cards = player1CardIds.map((id, index) =>
    convertToGameCard(id, index, 'player1', String(nextGameId++)),
  )
  const p2Cards = player2CardIds.map((id, index) =>
    convertToGameCard(id, index, 'player2', String(nextGameId++)),
  )

  const gs: GameState = {
    turn: 1,
    currentPlayer: 'player1',
    player1HP: 40,
    player2HP: 40,
    player1AP: 2,
    player2AP: 0,
    cards: [...p1Cards, ...p2Cards],
  }

  // Shuffle both decks
  shuffleDeckPure(gs, 'player1')
  shuffleDeckPure(gs, 'player2')

  // Draw initial hands (4 cards each)
  for (let i = 0; i < 4; i++) {
    drawCardForPlayerPure(gs, 'player1')
  }
  for (let i = 0; i < 4; i++) {
    drawCardForPlayerPure(gs, 'player2')
  }

  return gs
}
