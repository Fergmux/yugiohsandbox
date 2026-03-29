<template>
  <div class="mx-auto text-center text-neutral-300">
    <h1 class="my-8 text-4xl font-bold">{{ headerText }}</h1>
    <div>
      <h3 class="text-2xl">{{ bodyText }}</h3>
    </div>
    <button class="mt-8 rounded-md bg-neutral-700 px-4 py-2 text-neutral-300 hover:bg-neutral-600" @click="leaveCrawl">
      Leave crawl
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import { useConfetti } from '@/composables/crawler/useConfetti'

const { player, opponent, crawl, leaveGame } = useCrawlManager()
const { next } = usePageManager()
const { celebrate } = useConfetti()

const leaveCrawl = () => {
  leaveGame()
  next()
}
onMounted(() => {
  if (playerWins.value) {
    celebrate(10000)
  }
})

const playerWins = computed(() => {
  return crawl.value[player.value ?? 'player1'].wins >= 6
})

const opponentWins = computed(() => {
  return crawl.value[opponent.value ?? 'player2'].wins >= 6
})

const headerText = computed(() => {
  if (playerWins.value) {
    return 'Congratulations 🎉'
  } else if (opponentWins.value) {
    return 'Unlucky ☹️'
  } else {
    return 'Umm... 🤔'
  }
})

const bodyText = computed(() => {
  if (playerWins.value) {
    return "You won the crawl, you're now a Yugi Master!"
  } else if (opponentWins.value) {
    return "You lost the crawl, you'll get em next time!"
  } else {
    return 'The crawl is still in progress.'
  }
})
</script>
