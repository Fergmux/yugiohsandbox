<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import { useRoute } from 'vue-router'

import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import { useUserStore } from '@/stores/user'
import type { Crawl } from '@/types/crawl'

const route = useRoute()
const inputRef = ref<HTMLInputElement>()
const userStore = useUserStore()

const {
  crawl,
  gameCode,
  gameId,
  joinUrl,
  joinGame,
  createGame,
  leaveGame,
  copy,
  getCrawls,
  deleteCrawl,
  loadCrawl,
} = useCrawlManager()
const { next, currentPageIndex } = usePageManager()

const pastCrawls = ref<(Crawl & { id: string })[]>([])

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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
    gameCode.value = Number(route.params.gameCode)
    await joinGame()
  }
  pastCrawls.value = await getCrawls()
})
</script>

<template>
  <div>
    <!-- JOIN/CREATE GAME -->
    <div v-if="!gameId" class="m-auto flex w-max flex-col items-center">
      <div>
        <input
          v-model="gameCode"
          ref="inputRef"
          class="mt-2 mr-2 rounded-md border-1 border-gray-300 p-2"
          @keyup.enter="joinGame"
        />
        <button @click="joinGame" class="cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600">
          Join Game
        </button>
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
          v-for="c in pastCrawls"
          :key="c.id"
          class="flex items-center justify-between rounded-md border border-gray-300 p-4 text-sm"
        >
          <div class="flex flex-1 cursor-pointer items-center gap-6 hover:opacity-70" @click="resumeCrawl(c)">
            <span class="font-medium">{{ c.player1.name ?? '—' }} vs {{ c.player2.name ?? '—' }}</span>
            <span class="text-gray-500">Round {{ c.round }}</span>
            <span class="text-gray-400">{{ formatDate(c.created) }}</span>
          </div>
          <button
            @click="handleDeleteCrawl(c.id)"
            class="ml-4 cursor-pointer rounded-md border border-gray-300 px-2 py-0.5 active:bg-red-400"
          >
            Delete
          </button>
        </li>
      </ul>
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

      <br />
      <button
        v-if="crawl?.player2.id && crawl?.player1.id"
        class="mt-4 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
        @click="next"
      >
        Start Game!
      </button>
    </div>
  </div>
</template>
