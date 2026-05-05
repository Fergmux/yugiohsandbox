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
          v-if="isMyTurn && !waitingForReaction && !activationPending && !syncingLocalState"
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
      <button
        v-if="targetPending.optional"
        @click="confirmSelection()"
        :disabled="selectedTargets.length < targetPending.maxTargets"
        class="ml-3 text-emerald-800 hover:text-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Confirm
      </button>
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
import { type EffectDef, type GameCard, cards as cardDatabase } from '@/types/cards'
import { computed, nextTick, ref, type Ref } from 'vue'
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase/client'
import { evaluateChecks, evaluateConditions, filterByChecks, filterByTargets } from '@/composables/crawlv2/CheckSystem'
import { EventBus, Event } from '@/composables/crawlv2/EventBus'
import { useActivationPrompt } from '@/composables/crawlv2/useActivationPrompt'
import { useTargetSelector } from '@/composables/crawlv2/useTargetSelector'
import { clearBuffsFromSource, registerBuffSystems } from '@/composables/crawlv2/BuffSystem'
import { defaultGameState } from '@/types/defaultGameState'
import { registerEffectResolver } from '@/composables/crawlv2/EffectResolver'
import { registerGameState } from '@/composables/crawlv2/GameState'
import { cleanupEffects } from '@/composables/crawlv2/EffectHandlers'
import { authFetch } from '@/lib/authFetch'
import type {
  CrawlV2Game,
  PendingReaction,
  Player,
  SerializedEffectAction,
  SerializedSummonEffect,
} from '@/types/crawlv2-multiplayer'
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
const gameOver = computed<Player | null>(() => {
  if (multiplayerGame.value?.winner) return multiplayerGame.value.winner
  if (multiplayerGame.value?.status !== 'finished') return null
  if (gameState.value.player1HP <= 0) return 'player2'
  if (gameState.value.player2HP <= 0) return 'player1'
  return null
})

const playerNames = computed(() => ({
  player1: multiplayerGame.value?.players.player1?.username ?? 'Player 1',
  player2: multiplayerGame.value?.players.player2?.username ?? 'Player 2',
}))

function getTurnKey(gs: GameState): string {
  return `${gs.turn}:${gs.currentPlayer}`
}

function onGameStarted(game: CrawlV2Game, gId: string, player: Player) {
  multiplayerGame.value = game
  multiplayerGameId.value = gId
  myPlayer.value = player
  phase.value = 'game'
  fieldCardIds.clear()
  registeredEffectCardIds.clear()
  handledReactionId = null
  pendingStatusSyncBatches.value = []

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
    multiplayer: true,
  })

  lastTurnKey = getTurnKey(gameState.value)

  // Subscribe to realtime updates
  subscribeToGame(gId)

  // In multiplayer, the server has already shuffled decks, drawn initial hands, and set AP.
  // Do NOT fire GAME_START / TURN_START locally — they would re-shuffle, spend hand cards,
  // and draw again, corrupting state. The server snapshot is the source of truth.
}

const fieldCardIds = new Set<string>()
const registeredEffectCardIds = new Set<string>()
let handledReactionId: string | null = null
let lastTurnKey: string | null = null

type StatusSyncUpdate = {
  gameId: string
  buffs: Record<string, string | number>
  debuffs: Record<string, string | number>
  location?: Location
  faceUp?: boolean
  defensePosition?: boolean
}

type PendingStatusSyncBatch = {
  updates: StatusSyncUpdate[]
  player1HP?: number
  player2HP?: number
  player1AP?: number
  player2AP?: number
  serverVersion: number | null
}

const pendingStatusSyncBatches = ref<PendingStatusSyncBatch[]>([])
const syncingLocalState = computed(() => pendingStatusSyncBatches.value.length > 0)

function rebuildMultiplayerEffectRegistrations(cards: GameCard[]) {
  if (!effectResolver || !myPlayer.value) return

  // In multiplayer, snapshot hydration does not emit the field-leave / movement
  // events that normally clear source-derived ongoing state. Clear anything that
  // originated from our cards, then let current field sources re-apply.
  for (const card of cards) {
    if (card.owner !== myPlayer.value) continue
    clearBuffsFromSource(card.gameId)
  }

  const myFieldCards = cards.filter((card) => fieldZones.includes(card.location.type) && card.owner === myPlayer.value)
  const nextRegisteredIds = new Set(myFieldCards.map((card) => card.gameId))
  const idsToCleanup = new Set([...registeredEffectCardIds, ...nextRegisteredIds])

  for (const gameId of idsToCleanup) {
    const card = cards.find((candidate) => candidate.gameId === gameId)
    if (card) cleanupEffects(card)
  }

  for (const card of myFieldCards) {
    effectResolver.registerEffects(card)
  }

  registeredEffectCardIds.clear()
  for (const gameId of nextRegisteredIds) {
    registeredEffectCardIds.add(gameId)
  }
}

function syncGameStateFromServer(game: CrawlV2Game) {
  const serverGs = game.gameState
  pruneAcknowledgedStatusSyncBatches(game._version ?? 0)

  const syncedBase = buildPendingStatusSyncBase(serverGs)
  const hydrated = hydrateCards(syncedBase.cards as GameCard[])

  for (const card of hydrated) {
    const serverCard = (serverGs.cards as Record<string, unknown>[]).find(
      (candidate) => (candidate as unknown as GameCard).gameId === card.gameId,
    ) as Record<string, unknown> | undefined
    const activations = serverCard?.effectActivations as Record<number, number> | undefined
    if (activations && card.effects) {
      for (const [idx, count] of Object.entries(activations)) {
        const effect = card.effects[Number(idx)]
        if (effect) effect.activations = count
      }
    }
  }

  gameState.value.cards = hydrated
  gameState.value.turn = syncedBase.turn
  gameState.value.currentPlayer = syncedBase.currentPlayer
  gameState.value.player1HP = syncedBase.player1HP
  gameState.value.player2HP = syncedBase.player2HP
  gameState.value.player1AP = syncedBase.player1AP
  gameState.value.player2AP = syncedBase.player2AP

  return { serverGs, hydrated }
}

function isSourceDerivedStatusKey(key: string) {
  return key.includes(':')
}

function mergeSourceDerivedState(
  serverRecord: Record<string, string | number> | undefined,
  localRecord: Record<string, string | number> | undefined,
) {
  return Object.fromEntries([
    ...Object.entries(serverRecord ?? {}).filter(([key]) => !isSourceDerivedStatusKey(key)),
    ...Object.entries(localRecord ?? {}).filter(([key]) => isSourceDerivedStatusKey(key)),
  ])
}

function applyPendingStatusSyncBatch(gs: GameState, batch: PendingStatusSyncBatch) {
  for (const update of batch.updates) {
    const card = gs.cards.find((candidate) => candidate.gameId === update.gameId)
    if (!card) continue

    card.buffs = { ...update.buffs }
    card.debuffs = { ...update.debuffs }

    if (update.location) {
      const fullLocation = locations.find((location) => location.id === update.location?.id)
      card.location = fullLocation ? { ...fullLocation } : { ...update.location }
    }
    if (update.faceUp !== undefined) card.faceUp = update.faceUp
    if (update.defensePosition !== undefined) card.defensePosition = update.defensePosition
  }

  if (batch.player1HP !== undefined) gs.player1HP = batch.player1HP
  if (batch.player2HP !== undefined) gs.player2HP = batch.player2HP
  if (batch.player1AP !== undefined) gs.player1AP = batch.player1AP
  if (batch.player2AP !== undefined) gs.player2AP = batch.player2AP
}

function pruneAcknowledgedStatusSyncBatches(snapshotVersion: number) {
  pendingStatusSyncBatches.value = pendingStatusSyncBatches.value.filter(
    (batch) => batch.serverVersion === null || batch.serverVersion > snapshotVersion,
  )
}

function buildPendingStatusSyncBase(serverGs: GameState) {
  const base = JSON.parse(JSON.stringify(serverGs)) as GameState
  for (const batch of pendingStatusSyncBatches.value) {
    applyPendingStatusSyncBatch(base, batch)
  }
  return base
}

function shouldMirrorTurnStartEffect(effect: EffectDef) {
  return effect.trigger === Event.TURN_START && !effect.optional && effect.selectCount === undefined
}

function isServerResolvedSummonEffect(effect: EffectDef) {
  if (effect.trigger !== Event.UNIT_SUMMONED) return false
  if (effect.optional || effect.selectCount !== undefined) return false
  if (effect.conditions?.length || effect.then || effect.and?.length) return false
  if (effect.autoTarget || effect.matchSelection?.length) return false

  const isSelfTrigger =
    effect.triggerConditions?.length === 1 &&
    effect.triggerConditions[0]?.length === 1 &&
    effect.triggerConditions[0][0]?.comparitor === 'itself'

  const targetsSelfOnly =
    effect.targets?.length === 1 && effect.targets[0]?.length === 1 && effect.targets[0][0]?.comparitor === 'itself'

  return !!isSelfTrigger && !!targetsSelfOnly
}

function getServerResolvedSummonEffects(card: GameCard): SerializedSummonEffect[] | undefined {
  const effects = (card.effects ?? [])
    .map((effect, effectIndex) => ({ effect, effectIndex }))
    .filter(({ effect }) => isServerResolvedSummonEffect(effect))
    .map(({ effect, effectIndex }) => ({
      effectIndex,
      effectType: effect.effect,
      effectOptions: effect.options ? resolveEffectOptions(effect.options as Record<string, unknown>, card) : undefined,
    }))

  return effects.length ? effects : undefined
}

function getServerResolvedSummonEffectIndexes(card: GameCard) {
  return (card.effects ?? [])
    .map((effect, effectIndex) => ({ effect, effectIndex }))
    .filter(({ effect }) => isServerResolvedSummonEffect(effect))
    .map(({ effectIndex }) => effectIndex)
}

async function applyMirroredTurnStartEffects(gs: GameState) {
  if (!myPlayer.value || !effectResolver) return

  const mirroredCards = gs.cards.filter(
    (card) => fieldZones.includes(card.location.type) && card.owner && card.owner !== myPlayer.value,
  )

  for (const card of mirroredCards) {
    for (const effect of card.effects ?? []) {
      if (!shouldMirrorTurnStartEffect(effect)) continue
      if (effect.uses !== undefined && (effect.activations ?? 0) >= effect.uses) continue
      if (effect.triggerConditions?.length && !evaluateChecks(effect.triggerConditions, card, card)) continue
      if (!evaluateConditions(effect.conditions, card)) continue
      await effectResolver.activateEffect(card, effect)
    }
  }
}

async function processMultiplayerTurnStart(gs: GameState) {
  if (!myPlayer.value || !effectResolver) return

  if (gs.currentPlayer === myPlayer.value) {
    await EventBus.emit(Event.TURN_START, `turn:${getTurnKey(gs)}`, {
      currentPlayer: gs.currentPlayer,
      decrementBuffs: false,
      decrementDebuffs: false,
    })
    await applyMirroredTurnStartEffects(gs)
    syncCardBuffs()
    return
  }

  const myFieldCards = gs.cards.filter((card) => fieldZones.includes(card.location.type) && card.owner === myPlayer.value)
  for (const card of myFieldCards) {
    for (const effect of card.effects ?? []) {
      if (effect.trigger !== Event.TURN_START) continue
      if (effect.uses !== undefined && (effect.activations ?? 0) >= effect.uses) continue
      if (effect.triggerConditions?.length && !evaluateChecks(effect.triggerConditions, card, card)) continue
      if (!evaluateConditions(effect.conditions, card)) continue
      await effectResolver.activateEffect(card, effect)
    }
  }
  await applyMirroredTurnStartEffects(gs)
  syncCardBuffs()
}

function subscribeToGame(gId: string) {
  unsubscribeGame?.()
  unsubscribeGame = onSnapshot(doc(db, 'crawlv2_games', gId), async (snap) => {
    const data = snap.data() as CrawlV2Game | undefined
    if (!data) return
    multiplayerGame.value = data

    if (data.status === 'lobby') return

    const { serverGs, hydrated } = syncGameStateFromServer(data)

    if (data.status === 'active') {

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
      const turnChanged = getTurnKey(serverGs) !== lastTurnKey

      rebuildMultiplayerEffectRegistrations(hydrated)
      syncCardBuffs(true, { sourceDerivedOnly: true })

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
            let trapEffectOptions: Record<string, unknown> | undefined
            let trapTargets: string[] | undefined
            let trapThenEffect:
              | { effectType: string; effectOptions?: Record<string, unknown>; targets?: string[] }
              | undefined
            let trapAndEffects:
              | { effectType: string; effectOptions?: Record<string, unknown>; targets?: string[] }[]
              | undefined
            if (activate) {
              const triggerEffect =
                trapCard.effects?.find((e) => e.trigger === pendingReaction.triggerEvent) ??
                trapCard.effects?.find((e) => e.trigger !== 'manual')
              if (triggerEffect) {
                const serialized = serializeReactionEffect(triggerEffect, trapCard, pendingReaction)
                trapEffectType = serialized.trapEffectType
                trapEffectOptions = serialized.trapEffectOptions
                trapTargets = serialized.trapTargets
                trapThenEffect = serialized.trapThenEffect
                trapAndEffects = serialized.trapAndEffects
              }
            }
            await sendAction({
              type: 'react',
              reactionId: pendingReaction.id,
              activate,
              cardGameId: activate ? trapCardId : undefined,
              trapEffectType,
              trapEffectOptions,
              trapTargets,
              trapThenEffect,
              trapAndEffects,
            })
          })
        }
      }

      if (effectResolver && newFieldCards.length) {
        const myCards = newFieldCards.filter((c) => c.owner === myPlayer.value)
        if (myCards.length) {
          const cardsToEmit = [...myCards]
          nextTick(async () => {
            try {
              for (const card of cardsToEmit) {
                if (card.location.type === 'unit') {
                  await EventBus.emit(Event.UNIT_SUMMONED, card.gameId, {
                    card,
                    skipEffectIndexes: getServerResolvedSummonEffectIndexes(card),
                  })
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

      if (turnChanged) {
        lastTurnKey = getTurnKey(serverGs)
        nextTick(async () => {
          try {
            await processMultiplayerTurnStart(gameState.value)
          } catch (err) {
            console.error('[CrawlV2] Error processing turn start effects:', err)
          }
        })
      }
    }
  })
}

function normalizeSyncLocation(location: Location | undefined) {
  if (!location) return undefined
  return {
    id: location.id,
    type: location.type,
    player: location.player,
  }
}

function serializeLocationForSync(location: Location | undefined) {
  if (!location) return undefined
  return {
    id: location.id,
    type: location.type,
    index: location.index,
    player: location.player,
    name: location.name,
  }
}

function normalizeStateRecord(record: Record<string, string | number> | undefined) {
  return Object.fromEntries(Object.entries(record ?? {}).sort(([a], [b]) => a.localeCompare(b)))
}

type Crawlv2ActionResponse = {
  success?: boolean
  version?: number
  message?: string
}

async function syncCardBuffs(silent = true, options?: { sourceDerivedOnly?: boolean }) {
  const rawServerGs = multiplayerGame.value?.gameState
  if (!rawServerGs) return
  const serverGs = buildPendingStatusSyncBase(rawServerGs)

  const updates: StatusSyncUpdate[] = []

  for (const card of gameState.value.cards) {
    const serverCard = (serverGs.cards as GameCard[]).find((candidate) => candidate.gameId === card.gameId)
    if (!serverCard) continue

    const nextBuffs = options?.sourceDerivedOnly
      ? mergeSourceDerivedState(serverCard.buffs, card.buffs)
      : { ...card.buffs }
    const nextDebuffs = options?.sourceDerivedOnly
      ? mergeSourceDerivedState(serverCard.debuffs, card.debuffs)
      : { ...card.debuffs }

    const buffsChanged =
      JSON.stringify(normalizeStateRecord(nextBuffs)) !== JSON.stringify(normalizeStateRecord(serverCard.buffs))
    const debuffsChanged =
      JSON.stringify(normalizeStateRecord(nextDebuffs)) !== JSON.stringify(normalizeStateRecord(serverCard.debuffs))
    const locationChanged = options?.sourceDerivedOnly
      ? false
      : JSON.stringify(normalizeSyncLocation(card.location)) !== JSON.stringify(normalizeSyncLocation(serverCard.location))
    const faceUpChanged = options?.sourceDerivedOnly ? false : card.faceUp !== serverCard.faceUp
    const defenseChanged = options?.sourceDerivedOnly ? false : !!card.defensePosition !== !!serverCard.defensePosition

    if (!buffsChanged && !debuffsChanged && !locationChanged && !faceUpChanged && !defenseChanged) continue

    updates.push({
      gameId: card.gameId,
      buffs: nextBuffs,
      debuffs: nextDebuffs,
      ...(locationChanged ? { location: serializeLocationForSync(card.location) as Location } : {}),
      ...(faceUpChanged ? { faceUp: card.faceUp } : {}),
      ...(defenseChanged ? { defensePosition: !!card.defensePosition } : {}),
    })
  }

  const player1HPChanged = !options?.sourceDerivedOnly && gameState.value.player1HP !== serverGs.player1HP
  const player2HPChanged = !options?.sourceDerivedOnly && gameState.value.player2HP !== serverGs.player2HP
  const player1APChanged = !options?.sourceDerivedOnly && gameState.value.player1AP !== serverGs.player1AP
  const player2APChanged = !options?.sourceDerivedOnly && gameState.value.player2AP !== serverGs.player2AP

  if (!updates.length && !player1HPChanged && !player2HPChanged && !player1APChanged && !player2APChanged) return

  const batch: PendingStatusSyncBatch = {
    updates,
    ...(player1HPChanged ? { player1HP: gameState.value.player1HP } : {}),
    ...(player2HPChanged ? { player2HP: gameState.value.player2HP } : {}),
    ...(player1APChanged ? { player1AP: gameState.value.player1AP } : {}),
    ...(player2APChanged ? { player2AP: gameState.value.player2AP } : {}),
    serverVersion: null,
  }

  pendingStatusSyncBatches.value = [...pendingStatusSyncBatches.value, batch]

  const data = await sendAction(
    {
      type: 'update_card_buffs',
      updates,
      ...(player1HPChanged ? { player1HP: gameState.value.player1HP } : {}),
      ...(player2HPChanged ? { player2HP: gameState.value.player2HP } : {}),
      ...(player1APChanged ? { player1AP: gameState.value.player1AP } : {}),
      ...(player2APChanged ? { player2AP: gameState.value.player2AP } : {}),
    },
    { silent },
  )

  if (!data?.success || typeof data.version !== 'number') {
    pendingStatusSyncBatches.value = pendingStatusSyncBatches.value.filter((candidate) => candidate !== batch)
    return
  }

  batch.serverVersion = data.version
  const snapshotVersion = multiplayerGame.value?._version ?? 0
  if (batch.serverVersion <= snapshotVersion) {
    pendingStatusSyncBatches.value = pendingStatusSyncBatches.value.filter((candidate) => candidate !== batch)
  }
}

async function sendAction(action: Record<string, unknown>, options?: { silent?: boolean }) {
  if (!options?.silent) actionLoading.value = true
  try {
    const res = await authFetch('/.netlify/functions/crawlv2-action', {
      method: 'POST',
      body: JSON.stringify({
        gameId: multiplayerGameId.value,
        action: { ...action, actionId: uuid() },
      }),
    })
    const data = (await res.json()) as Crawlv2ActionResponse
    if (!res.ok) {
      console.error('Action failed:', data.message)
      return data
    }
    return data
  } catch (err) {
    console.error('Action error:', err)
  } finally {
    if (!options?.silent) actionLoading.value = false
  }
}


// ─── Composables ────────────────────────────────────────────────────────────

const { ask, pending: activationPending } = useActivationPrompt()
const {
  pending,
  selectedTargets,
  toggleTarget,
  confirmSelection,
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
        const rest = { ...entry }
        delete rest.countChecks
        return { ...rest, count }
      }
      return entry
    })
  }
  return resolved
}

function resolveReactionTargets(effect: EffectDef, card: GameCard, reaction: PendingReaction): string[] | undefined {
  if (effect.autoTarget === 'event_source' && reaction.eventSourceGameId) {
    return [reaction.eventSourceGameId]
  }
  if (effect.autoTarget === 'event_target' && reaction.eventTargetGameId) {
    return [reaction.eventTargetGameId]
  }
  if (effect.targets?.length && effect.selectCount === undefined) {
    return filterByTargets(effect.targets, card).map((target) => target.gameId)
  }
  return undefined
}

function serializeFollowUpEffect(
  effect: EffectDef | undefined,
  card: GameCard,
  targets?: string[],
): SerializedEffectAction | undefined {
  if (!effect) return undefined
  return {
    effectType: effect.effect,
    effectOptions: effect.options ? resolveEffectOptions(effect.options as Record<string, unknown>, card) : undefined,
    targets,
  }
}

function serializeReactionEffect(effect: EffectDef, card: GameCard, reaction: PendingReaction) {
  return {
    trapEffectType: effect.effect,
    trapEffectOptions: effect.options ? resolveEffectOptions(effect.options as Record<string, unknown>, card) : undefined,
    trapTargets: resolveReactionTargets(effect, card, reaction),
    trapThenEffect: effect.then
      ? {
          effectType: effect.then.effect,
          effectOptions: effect.then.options
            ? resolveEffectOptions(effect.then.options as Record<string, unknown>, card)
            : undefined,
          targets: resolveReactionTargets(effect.then, card, reaction),
        }
      : undefined,
    trapAndEffects: effect.and?.map((sibling) => ({
      effectType: sibling.effect,
      effectOptions: sibling.options ? resolveEffectOptions(sibling.options as Record<string, unknown>, card) : undefined,
      targets: resolveReactionTargets(sibling, card, reaction),
    })),
  }
}

function isBlinded(card: GameCard): boolean {
  return typeof card.debuffs.blind === 'number' && card.debuffs.blind > 0
}

function pickRandomTarget(validTargets: GameCard[]): GameCard {
  return validTargets[Math.floor(Math.random() * validTargets.length)]
}

async function selectAttackTargets(card: GameCard, effectIndex: number, validTargets: GameCard[]) {
  const effect = card.effects?.[effectIndex]
  if (!effect) return []

  setAttackingCard(card)
  try {
    if (isBlinded(card)) {
      return [pickRandomTarget(validTargets)]
    }
    return await selectTargets(validTargets, effect)
  } finally {
    setAttackingCard(null)
  }
}

const activateEffect = async (card: GameCard, effectIndex: number) => {
  if (!isMyTurn.value) return
  if (syncingLocalState.value) return
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
        ...(zoneType === 'unit' ? { summonEffects: getServerResolvedSummonEffects(card) } : {}),
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
      const trapReactionRules = (card.effects ?? [])
        .filter((e) => e.trigger !== 'manual')
        .map((e) => ({
          trigger: e.trigger as string,
          requiresUndefinedSelectCount: e.conditions?.some(
            (condition) =>
              condition.test === 'trigger_effect' &&
              condition.checks?.some((group) =>
                group.some((check) => check.comparitor === 'is_undefined' && check.key === 'selectCount'),
              ),
          ),
        }))
      await sendAction({
        type: 'set_trap',
        cardGameId: card.gameId,
        zoneId: zone.id,
        cost: card.cost,
        trapTriggers,
        trapReactionRules,
      })
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
      const targets = await selectAttackTargets(card, effectIndex, validTargets)
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
        selectCount: effect.selectCount,
        effectType: effect.effect,
        effectOptions: resolvedOptions,
        thenEffect: serializeFollowUpEffect(effect.then, card),
        andEffects: effect.and?.map((sibling) => serializeFollowUpEffect(sibling, card)!),
        spentOnUse: !!effect.spentOnUse,
        maxUses: effect.uses,
      })
      break
    }
  }
}

// ─── Turn management ──────────────────────────────────────────────────────────

const endTurn = async () => {
  if (syncingLocalState.value) return
  await sendAction({ type: 'end_turn' })
}

// ─── Game state ──────────────────────────────────────────────────────────────

const gameState: Ref<GameState> = ref(defaultGameState)

let effectResolver: ReturnType<typeof registerEffectResolver>
</script>

<style scoped></style>
