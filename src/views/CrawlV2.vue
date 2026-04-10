<template>
  <div v-if="phase === 'lobby'">
    <CrawlV2Lobby @game-started="onGameStarted" />
  </div>

  <div v-else-if="phase === 'game'" class="relative flex h-screen w-screen items-center justify-center">
    <!-- Top HUD -->
    <div class="absolute top-3 right-0 left-0 z-10 flex items-center justify-between px-6">
      <div class="flex items-center gap-2 rounded bg-black/70 px-3 py-1 text-sm text-white">
        <span class="text-gray-300">{{ playerNames.player1 }}</span>
        <span class="font-bold text-red-400">{{ gameState.player1HP }} LP</span>
        <span class="font-bold text-blue-400">{{ gameState.player1AP }} AP</span>
      </div>

      <div class="flex items-center gap-3">
        <div class="rounded bg-black/70 px-3 py-1 text-sm text-white">
          Turn {{ gameState.turn }} &mdash;
          <span class="font-bold">{{ gameState.currentPlayer === 'player1' ? playerNames.player1 : playerNames.player2 }}'s turn</span>
        </div>
        <button
          v-if="isMyTurn && !waitingForReaction"
          @click="endTurn"
          :disabled="actionLoading"
          class="rounded bg-emerald-700 px-3 py-1 text-sm font-bold text-white hover:bg-emerald-600 active:bg-emerald-800 disabled:opacity-50"
        >
          End Turn
        </button>
      </div>

      <div class="flex items-center gap-2 rounded bg-black/70 px-3 py-1 text-sm text-white">
        <span class="font-bold text-blue-400">{{ gameState.player2AP }} AP</span>
        <span class="font-bold text-red-400">{{ gameState.player2HP }} LP</span>
        <span class="text-gray-300">{{ playerNames.player2 }}</span>
      </div>
    </div>

    <!-- Waiting overlay -->
    <div
      v-if="waitingForReaction && isMyTurn"
      class="absolute top-14 left-1/2 z-30 -translate-x-1/2 rounded bg-purple-600 px-4 py-1.5 text-sm font-bold text-white shadow-lg"
    >
      Waiting for opponent response...
    </div>


    <!-- Prompts -->
    <div
      v-if="targetPending"
      class="absolute top-14 left-1/2 z-20 -translate-x-1/2 rounded bg-amber-400 px-4 py-1.5 text-sm font-bold text-black shadow-lg"
    >
      Select a target ({{ selectedTargets.length }}/{{ targetPending.maxTargets }})
      <button v-if="targetPending.optional" @click="cancelSelection()" class="ml-3 text-red-700 hover:text-red-900">
        Cancel
      </button>
    </div>
    <div
      v-else-if="pendingZone"
      class="absolute top-14 left-1/2 z-20 -translate-x-1/2 rounded bg-emerald-400 px-4 py-1.5 text-sm font-bold text-black shadow-lg"
    >
      Select a zone to summon {{ pendingZone.label ?? 'card' }}
      <button @click="cancelZoneSelection()" class="ml-3 text-red-700 hover:text-red-900">Cancel</button>
    </div>

    <!-- Game over overlay -->
    <div
      v-if="gameOver"
      class="absolute inset-0 z-50 flex items-center justify-center bg-black/80"
    >
      <div class="rounded-xl bg-gray-800 p-8 text-center text-white shadow-2xl">
        <h2 class="text-4xl font-bold">{{ gameOver === myPlayer ? 'You Win!' : 'You Lose!' }}</h2>
      </div>
    </div>

    <CardPickerModal />

    <div
      class="mx-auto grid w-[130vh] grid-cols-[2fr_2fr_3fr_3fr_3fr_2fr_2fr] grid-rows-[3fr_2fr_3fr_3fr_0.5fr_3fr_3fr_2fr_3fr] gap-x-[min(80px,3vh)] gap-y-2 bg-cover bg-center bg-no-repeat px-[min(15vw,30vh)] py-[5vh] select-none"
      :style="{ backgroundImage: `url(${playspaceImg})` }"
    >
      <FieldZone
        v-for="location in locations"
        class="col-span-1"
        :class="{
          'cursor-crosshair ring-2 ring-red-500': isValidTarget(location),
          'ring-2 ring-orange-400': isSelectedTarget(location),
          'cursor-pointer ring-2 ring-emerald-400': isValidSummonTarget(location),
        }"
        :key="location.id"
        :name="location.name"
        :card="getCard(location)"
        :type="location.type"
        :location="location"
        :turn="gameState.turn"
        :current-player="gameState.currentPlayer"
        :my-player="myPlayer ?? undefined"
        :all-cards="gameState.cards"
        @click="handleZoneClick(location)"
        @mouseenter="handleZoneHover(location)"
        @mouseleave="handleZoneHover(null)"
        @activate-effect="activateEffect"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FieldZone from '@/components/crawlv2/zones/FieldZone.vue'
import CardPickerModal from '@/components/crawlv2/CardPickerModal.vue'
import CrawlV2Lobby from '@/components/crawlv2/CrawlV2Lobby.vue'
import { fieldZones, locations, type Location, type GameState } from '@/types/crawlv2'
import playspaceImg from '@/assets/images/playspace.png'
import { type GameCard, cards as cardDatabase } from '@/types/cards'
import { computed, nextTick, ref, type Ref } from 'vue'
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { filterByChecks, filterByTargets } from '@/composables/crawlv2/CheckSystem'
import { EventBus, Event } from '@/composables/crawlv2/EventBus'
import { useActivationPrompt } from '@/composables/crawlv2/useActivationPrompt'
import { useTargetSelector } from '@/composables/crawlv2/useTargetSelector'
import { registerBuffSystems } from '@/composables/crawlv2/BuffSystem'
import { defaultGameState } from '@/types/defaultGameState'
import { registerEffectResolver } from '@/composables/crawlv2/EffectResolver'
import { registerGameState } from '@/composables/crawlv2/GameState'
import { authFetch } from '@/lib/authFetch'
import type { CrawlV2Game, Player } from '@/types/crawlv2-multiplayer'
import { v4 as uuid } from 'uuid'

// ─── Card hydration ─────────────────────────────────────────────────────────
// Server stores minimal card shells (just id + location + owner + buffs/debuffs).
// Client enriches them with full card data (name, image, atk, def, cost, effects, etc.)

function hydrateCards(serverCards: GameCard[]): GameCard[] {
  return serverCards.map((sc) => {
    const def = cardDatabase.find((c) => c.id === sc.id)
    // Hydrate location with full client-side data (behind, inFront, adjacent, etc.)
    const fullLocation = locations.find((l) => l.id === sc.location.id)
    const hydratedLocation = fullLocation ? { ...fullLocation } : sc.location
    if (!def) return { ...sc, location: hydratedLocation }
    return {
      ...sc,
      location: hydratedLocation,
      name: def.name,
      image: def.image,
      atk: sc.atk ?? def.atk,
      def: sc.def ?? def.def,
      cost: def.cost,
      type: def.type,
      race: def.race,
      damage: def.damage,
      description: def.description,
      effects: def.effects?.map((e) => ({ ...e })),
      rarity: def.rarity,
    }
  })
}

// ─── Multiplayer state ─────────────────────────────────────────────────────────

const phase = ref<'lobby' | 'game'>('lobby')
const multiplayerGame = ref<CrawlV2Game | null>(null)
const multiplayerGameId = ref<string | null>(null)
const myPlayer = ref<Player | null>(null)
const actionLoading = ref(false)
let unsubscribeGame: Unsubscribe | null = null

const isMyTurn = computed(() => gameState.value.currentPlayer === myPlayer.value)
const waitingForReaction = computed(() => !!multiplayerGame.value?.pendingReaction)
const gameOver = computed(() => multiplayerGame.value?.winner ?? null)

const playerNames = computed(() => ({
  player1: multiplayerGame.value?.players.player1?.username ?? 'Player 1',
  player2: multiplayerGame.value?.players.player2?.username ?? 'Player 2',
}))

function onGameStarted(game: CrawlV2Game, gId: string, player: Player) {
  multiplayerGame.value = game
  multiplayerGameId.value = gId
  myPlayer.value = player
  phase.value = 'game'

  // Set up game state from server, hydrating cards with full data
  const gs = JSON.parse(JSON.stringify(game.gameState)) as GameState
  gs.cards = hydrateCards(gs.cards)
  gameState.value = gs
  registerGameState(gameState.value)

  registerBuffSystems()

  effectResolver = registerEffectResolver({
    selectCard: (card) => {
      selectedCard.value = card
    },
    ask,
  })

  // Subscribe to realtime updates
  subscribeToGame(gId)

  // In multiplayer, the server has already shuffled decks, drawn initial hands, and set AP.
  // Do NOT fire GAME_START / TURN_START locally — they would re-shuffle, spend hand cards,
  // and draw again, corrupting state. The server snapshot is the source of truth.
}

const fieldCardIds = new Set<string>()
let handledReactionId: string | null = null

function subscribeToGame(gId: string) {
  unsubscribeGame?.()
  unsubscribeGame = onSnapshot(doc(db, 'crawlv2_games', gId), async (snap) => {
    const data = snap.data() as CrawlV2Game | undefined
    if (!data) return
    multiplayerGame.value = data

    if (data.status === 'active') {
      // Update local game state from server snapshot, hydrating cards
      const serverGs = data.gameState
      const hydrated = hydrateCards(serverGs.cards as GameCard[])
      // Sync server-tracked activation counts back to client-side effects
      for (const card of hydrated) {
        const serverCard = (serverGs.cards as Record<string, unknown>[]).find(
          (sc) => (sc as unknown as GameCard).gameId === card.gameId,
        ) as Record<string, unknown> | undefined
        const activations = serverCard?.effectActivations as Record<number, number> | undefined
        if (activations && card.effects) {
          for (const [idx, count] of Object.entries(activations)) {
            const effect = card.effects[Number(idx)]
            if (effect) effect.activations = count
          }
        }
      }

      // Detect newly field-placed cards before updating state
      const fieldTypes = new Set(['unit', 'power', 'trap'])
      const newFieldCards: GameCard[] = []
      for (const card of hydrated) {
        if (fieldTypes.has(card.location.type) && !fieldCardIds.has(card.gameId)) {
          newFieldCards.push(card)
        }
      }

      // Update tracked set
      fieldCardIds.clear()
      for (const card of hydrated) {
        if (fieldTypes.has(card.location.type)) fieldCardIds.add(card.gameId)
      }

      gameState.value.cards = hydrated
      gameState.value.turn = serverGs.turn
      gameState.value.currentPlayer = serverGs.currentPlayer
      gameState.value.player1HP = serverGs.player1HP
      gameState.value.player2HP = serverGs.player2HP
      gameState.value.player1AP = serverGs.player1AP
      gameState.value.player2AP = serverGs.player2AP

      // Register effects and fire events for newly placed cards.
      // Only process triggered effects for our own cards — the owner's client
      // handles target selection and syncs buffs back to the server.
      // We register listeners synchronously, then defer event emission to nextTick
      // so Vue has flushed DOM updates (component mount/unmount) before any effect
      // handler tries to show target selection UI via selectTargets.
      // Handle pending reaction using the card-level activation prompt
      const pendingReaction = data.pendingReaction
      if (pendingReaction && pendingReaction.respondingPlayer === myPlayer.value && pendingReaction.id !== handledReactionId) {
        handledReactionId = pendingReaction.id
        const trapCardId = pendingReaction.eligibleCards[0]
        const trapCard = hydrated.find((c) => c.gameId === trapCardId)
        if (trapCard) {
          nextTick(async () => {
            const activate = await ask(trapCard)
            let trapEffectType: string | undefined
            if (activate) {
              const triggerEffect = trapCard.effects?.find((e) => e.trigger !== 'manual')
              trapEffectType = triggerEffect?.effect
            }
            await sendAction({
              type: 'react',
              reactionId: pendingReaction.id,
              activate,
              cardGameId: activate ? trapCardId : undefined,
              trapEffectType,
            })
          })
        }
      }

      if (effectResolver && newFieldCards.length) {
        const myCards = newFieldCards.filter((c) => c.owner === myPlayer.value)
        for (const card of myCards) {
          effectResolver.registerEffects(card)
        }
        if (myCards.length) {
          const cardsToEmit = [...myCards]
          nextTick(async () => {
            try {
              for (const card of cardsToEmit) {
                if (card.location.type === 'unit') {
                  await EventBus.emit(Event.UNIT_SUMMONED, card.gameId, { card })
                } else if (card.location.type === 'power') {
                  await EventBus.emit(Event.POWER_SET, card.gameId, { card })
                } else if (card.location.type === 'trap') {
                  await EventBus.emit(Event.TRAP_SET, card.gameId, { card })
                }
              }
              // Sync any buff/debuff changes from triggered effects back to server
              syncCardBuffs()
            } catch (err) {
              console.error('[CrawlV2] Error processing triggered effects:', err)
            }
          })
        }
      }
    }
  })
}

function syncCardBuffs() {
  const updates: { gameId: string; buffs: Record<string, string | number>; debuffs: Record<string, string | number> }[] = []
  for (const card of gameState.value.cards) {
    if (Object.keys(card.buffs).length > 0 || Object.keys(card.debuffs).length > 0) {
      updates.push({ gameId: card.gameId, buffs: { ...card.buffs }, debuffs: { ...card.debuffs } })
    }
  }
  if (updates.length) {
    sendAction({ type: 'update_card_buffs', updates })
  }
}

async function sendAction(action: Record<string, unknown>) {
  actionLoading.value = true
  try {
    const res = await authFetch('/.netlify/functions/crawlv2-action', {
      method: 'POST',
      body: JSON.stringify({
        gameId: multiplayerGameId.value,
        action: { ...action, actionId: uuid() },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Action failed:', data.message)
    }
  } catch (err) {
    console.error('Action error:', err)
  } finally {
    actionLoading.value = false
  }
}


// ─── Composables ────────────────────────────────────────────────────────────

const { ask } = useActivationPrompt()
const {
  pending,
  selectedTargets,
  toggleTarget,
  cancelSelection,
  pendingZone,
  pickZone,
  cancelZoneSelection,
  setHoveredTarget,
  selectZone,
  selectTargets,
  selectCards,
  setAttackingCard,
} = useTargetSelector()
const targetPending = computed(() => pending.value)

const selectedCard = ref<GameCard | null>(null)

// ─── Card helpers ────────────────────────────────────────────────────────────

const getCard = (location: Location): GameCard | null => {
  if (!location) return null
  return gameState.value.cards.find((card) => card.location.id === location.id) ?? null
}

const isValidTarget = (location: Location): boolean => {
  if (!pending.value) return false
  const card = getCard(location)
  return card ? pending.value.validTargets.some((t) => t.gameId === card.gameId) : false
}

const isSelectedTarget = (location: Location): boolean => {
  if (!selectedTargets.value.length) return false
  const card = getCard(location)
  return card ? selectedTargets.value.some((t) => t.gameId === card.gameId) : false
}

const isValidSummonTarget = (location: Location): boolean =>
  pendingZone.value?.validZones.some((z) => z.id === location.id) ?? false

const handleZoneClick = (location: Location) => {
  if (pending.value) {
    const card = getCard(location)
    if (card && pending.value.validTargets.some((t) => t.gameId === card.gameId)) {
      toggleTarget(card)
    }
    return
  }
  if (pendingZone.value) {
    if (isValidSummonTarget(location)) pickZone(location)
    else cancelZoneSelection()
  }
}

const handleZoneHover = (location: Location | null) => {
  if (!pending.value || !location) {
    setHoveredTarget(null)
    return
  }
  const card = getCard(location)
  if (card && pending.value.validTargets.some((t) => t.gameId === card.gameId)) {
    setHoveredTarget(card)
  } else {
    setHoveredTarget(null)
  }
}

// Resolve countChecks in buff/debuff options to plain count values so the server
// doesn't need the CheckSystem. countChecks is Check[][] which Firestore can't store anyway.
function resolveEffectOptions(options: Record<string, unknown>, card: GameCard): Record<string, unknown> {
  const resolved = { ...options }
  for (const listKey of ['buffs', 'debuffs'] as const) {
    const list = resolved[listKey]
    if (!Array.isArray(list)) continue
    resolved[listKey] = list.map((entry: Record<string, unknown>) => {
      if (entry.countChecks) {
        const count = filterByChecks(entry.countChecks as Parameters<typeof filterByChecks>[0], card).length
        const { countChecks: _, ...rest } = entry
        return { ...rest, count }
      }
      return entry
    })
  }
  return resolved
}

const activateEffect = async (card: GameCard, effectIndex: number) => {
  if (!isMyTurn.value) return
  const effect = card.effects?.[effectIndex]
  if (!effect) return

  switch (effect.effect) {
    case 'summon': {
      const zoneType = card.type === 'unit' ? 'unit' : card.type === 'power' ? 'power' : null
      if (!zoneType) return
      const validZones = locations.filter(
        (loc) => loc.type === zoneType && loc.player === card.owner && !getCard(loc),
      )
      if (!validZones.length) return
      const zone = await selectZone(validZones, card.name ?? undefined)
      if (!zone) return
      await sendAction({
        type: zoneType === 'unit' ? 'summon_unit' : 'set_power',
        cardGameId: card.gameId,
        zoneId: zone.id,
        cost: card.cost,
        atk: card.atk,
        def: card.def,
        damage: card.damage,
      })
      break
    }
    case 'set_trap': {
      const validZones = locations.filter(
        (loc) => loc.type === 'trap' && loc.player === card.owner && !getCard(loc),
      )
      if (!validZones.length) return
      const zone = await selectZone(validZones, card.name ?? undefined)
      if (!zone) return
      // Send trap trigger types so the server can check for reactions
      const trapTriggers = (card.effects ?? [])
        .filter((e) => e.trigger !== 'manual')
        .map((e) => e.trigger as string)
      await sendAction({ type: 'set_trap', cardGameId: card.gameId, zoneId: zone.id, cost: card.cost, trapTriggers })
      break
    }
    case 'set_power': {
      const validZones = locations.filter(
        (loc) => loc.type === 'power' && loc.player === card.owner && !getCard(loc),
      )
      if (!validZones.length) return
      const zone = await selectZone(validZones, card.name ?? undefined)
      if (!zone) return
      await sendAction({ type: 'set_power', cardGameId: card.gameId, zoneId: zone.id, cost: card.cost })
      break
    }
    case 'damage': {
      if (card.owner === 'player1' && gameState.value.turn === 1) return

      // Check for opponent units
      const opponentUnits = filterByChecks(
        [[
          { comparitor: 'equals', key: 'location.type', value: 'unit' },
          { comparitor: 'owner', value: 'opponent' },
        ]],
        card,
      )
      if (!opponentUnits.length) {
        // Direct attack to LP
        await sendAction({ type: 'direct_attack', sourceGameId: card.gameId, effectIndex, maxUses: effect.uses })
        break
      }
      // Select attack target
      const validTargets = filterByTargets(effect.targets ?? [], card).filter(
        (t) => !(typeof t.buffs.evasive === 'number' && t.buffs.evasive > 0),
      )
      if (!validTargets.length) return
      setAttackingCard(card)
      const targets = await selectTargets(validTargets, effect)
      setAttackingCard(null)
      if (!targets.length) return
      await sendAction({
        type: 'attack',
        sourceGameId: card.gameId,
        targetGameId: targets[0].gameId,
        effectIndex,
        maxUses: effect.uses,
      })
      break
    }
    case 'sacrifice': {
      await sendAction({ type: 'sacrifice', cardGameId: card.gameId, cost: card.cost })
      break
    }
    case 'swap_stance': {
      await sendAction({ type: 'swap_stance', cardGameId: card.gameId, effectIndex, maxUses: effect.uses })
      break
    }
    default: {
      // Generic effect — run local target selection if needed, then send to server
      let targetGameIds: string[] | undefined
      if (effect.targets?.length) {
        const validTargets = filterByTargets(effect.targets, card)
        if (!validTargets.length) return
        // Use card picker overlay for off-board targets that need selection
        const onField = validTargets.every((t) => fieldZones.includes(t.location.type))
        let selected: GameCard[]
        if (!onField && effect.selectCount !== undefined) {
          selected = await selectCards(validTargets, effect.selectCount, `Select target`)
        } else {
          selected = await selectTargets(validTargets, effect)
        }
        if (!selected.length) return
        targetGameIds = selected.map((t) => t.gameId)
      }
      // Resolve countChecks client-side so the server gets plain count values
      const resolvedOptions = effect.options ? resolveEffectOptions(effect.options, card) : {}
      await sendAction({
        type: 'activate_effect',
        cardGameId: card.gameId,
        effectIndex,
        targets: targetGameIds,
        effectType: effect.effect,
        effectOptions: resolvedOptions,
        spentOnUse: !!effect.spentOnUse,
        maxUses: effect.uses,
      })
      break
    }
  }
}

// ─── Turn management ──────────────────────────────────────────────────────────

const endTurn = async () => {
  await sendAction({ type: 'end_turn' })
}

// ─── Game state ──────────────────────────────────────────────────────────────

const gameState: Ref<GameState> = ref(defaultGameState)

let effectResolver: ReturnType<typeof registerEffectResolver>
</script>

<style scoped></style>
