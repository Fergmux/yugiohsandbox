<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import { useRoute } from 'vue-router'

import InviteFriendsModal from '@/components/InviteFriendsModal.vue'
import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import { useUserStore } from '@/stores/user'
import type { Crawl } from '@/types/crawl'

const route = useRoute()
const inputRef = ref<HTMLInputElement>()
const userStore = useUserStore()

const { crawl, player, gameCode, gameId, joinUrl, joinGame, createGame, leaveGame, copy, getCrawls, deleteCrawl, loadCrawl } =
  useCrawlManager()
const { currentPageIndex, moveBothToPage } = usePageManager()

const pastCrawls = ref<(Crawl & { id: string })[]>([])
const showInviteModal = ref(false)
const localGameCode = ref<number | null>(null)
const joinError = ref('')

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const startGame = async () => {
  await moveBothToPage(1)
}

const tryJoinGame = async () => {
  if (!localGameCode.value) return
  joinError.value = ''
  try {
    await joinGame(localGameCode.value)
  } catch {
    joinError.value = 'Game not found'
  }
}

async function handleDeleteCrawl(id: string) {
  await deleteCrawl(id)
  pastCrawls.value = pastCrawls.value.filter((p) => p.id !== id)
}

async function resumeCrawl(c: Crawl & { id: string }) {
  // Resolve player/page from the raw data before touching reactive state
  const myPlayer = c.player1.id === userStore.user?.id ? 'player1' : 'player2'
  const myPage = c[myPlayer]?.page ?? 1
  loadCrawl(c)
  // Wait for the DOM update caused by gameId changing before triggering navigation,
  // otherwise the currentPage watcher fires (pre-flush) while NewGame.vue still has
  // a pending patch, causing Vue to insertBefore into a null parent.
  await nextTick()
  currentPageIndex.value = myPage
}

onMounted(async () => {
  inputRef.value?.focus()
  if (route.params.gameCode) {
    try {
      await joinGame(Number(route.params.gameCode))
    } catch {
      joinError.value = 'Game not found'
    }
  }
  pastCrawls.value = await getCrawls()
})
</script>

<template>
  <div>
    <!-- JOIN/CREATE GAME -->
    <div v-if="!gameId" class="m-auto flex w-max flex-col items-center">
      <div class="flex flex-col items-center">
        <div>
          <input
            v-model="localGameCode"
            ref="inputRef"
            class="mt-2 mr-2 rounded-md border-1 border-gray-300 p-2"
            @keyup.enter="tryJoinGame"
            @input="joinError = ''"
          />
          <button
            :disabled="!localGameCode"
            @click="tryJoinGame"
            class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-default disabled:opacity-50 disabled:active:bg-transparent"
          >
            Join Game
          </button>
        </div>
        <p v-if="joinError" class="mt-2 text-sm text-red-400">{{ joinError }}</p>
      </div>
      <p class="m-4">or</p>
      <button @click="createGame" class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600">
        Create Game
      </button>
    </div>

    <!-- PAST CRAWLS -->
    <div v-if="!gameId && pastCrawls.length" class="m-auto mt-8 w-full max-w-md">
      <h2 class="mb-3 text-center text-sm font-semibold tracking-wide text-gray-500 uppercase">Your past crawls</h2>
      <ul class="flex flex-col gap-4">
        <li
          v-for="crwl in pastCrawls"
          :key="crwl.id"
          class="flex items-center justify-between rounded-md border border-gray-300 p-4 text-sm"
        >
          <div class="flex flex-1 cursor-pointer items-center gap-6 hover:opacity-70" @click="resumeCrawl(crwl)">
            <span class="font-medium">{{ crwl.player1.name ?? '—' }} vs {{ crwl.player2.name ?? '—' }}</span>
            <span class="text-gray-500">Round {{ crwl.round }}</span>
            <span class="text-gray-400">{{ formatDate(crwl.created) }}</span>
          </div>
          <button
            @click="handleDeleteCrawl(crwl.id)"
            class="ml-4 cursor-pointer rounded-md border border-gray-300 px-2 py-0.5 active:bg-red-400"
          >
            Delete
          </button>
        </li>
      </ul>
    </div>

    <div v-else-if="gameId && !player" class="m-auto w-fit text-center">
      <p class="text-lg font-semibold text-gray-400">Spectating</p>
      <p class="text-lg">
        Room code: <span class="text-lg font-bold">{{ gameCode }}</span>
      </p>
      <p class="mt-2 text-gray-400">Waiting for players to start...</p>
    </div>
    <div v-else-if="gameId" class="m-auto w-fit text-center">
      <p class="text-lg">
        Room code: <span class="text-lg font-bold">{{ gameCode }}</span>
      </p>
      <button @click="leaveGame" class="mt-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600">
        Leave Game
      </button>
      <button
        @click="copy(joinUrl)"
        class="mt-4 ml-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
      >
        Copy Link
      </button>
      <button
        @click="showInviteModal = true"
        class="mt-4 ml-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
      >
        Invite Friend
      </button>

      <br />
      <button
        v-if="crawl?.player2.id && crawl?.player1.id"
        class="mt-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
        @click="startGame"
      >
        Start Game!
      </button>
    </div>
    <invite-friends-modal
      v-if="showInviteModal && gameCode"
      type="crawl"
      :game-code="String(gameCode)"
      @close="showInviteModal = false"
    />
  </div>
</template>
