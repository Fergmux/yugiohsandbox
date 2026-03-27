<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useRoute } from 'vue-router'

import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'

const route = useRoute()
const inputRef = ref<HTMLInputElement>()

const { crawl, gameCode, gameId, joinUrl, joinGame, createGame, leaveGame, copy } = useCrawlManager()
const { next } = usePageManager()

onMounted(async () => {
  inputRef.value?.focus()
  if (route.params.gameCode) {
    gameCode.value = Number(route.params.gameCode)
    await joinGame()
  }
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

    <div v-else class="m-auto w-fit text-center">
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
