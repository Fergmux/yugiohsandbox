<template>
  <div class="mx-auto text-center text-neutral-300">
    <h1 class="my-8 text-4xl font-bold">{{ headerText }}</h1>
    <div>
      <h3 class="text-2xl">{{ bodyText }}</h3>
    </div>
    <button
      class="mt-8 cursor-pointer rounded-md bg-neutral-700 px-4 py-2 text-neutral-300 hover:bg-neutral-600"
      @click="leaveCrawl"
    >
      Leave crawl
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { useCrawlManager } from '@/composables/crawler/crawlManager'
import { usePageManager } from '@/composables/crawler/pageManager'
import { useConfetti } from '@/composables/crawler/useConfetti'
import router from '@/router'

const { player, opponent, crawl, leaveGame } = useCrawlManager()
const { reset } = usePageManager()
const { celebrate } = useConfetti()

const leaveCrawl = () => {
  leaveGame()
  reset()
  router.push({ name: 'crawler' })
}
onMounted(() => {
  if (playerWins.value) {
    celebrate(10000)
  }
})

const totalDuels = computed(() => crawl.value.modifiers?.totalDuels ?? 11)
const isSpectator = computed(() => player.value === null)

const playerWins = computed(() => {
  return crawl.value[player.value ?? 'player1'].wins >= totalDuels.value / 2
})

const opponentWins = computed(() => {
  return crawl.value[opponent.value ?? 'player2'].wins >= totalDuels.value / 2
})

const winner = computed(() => {
  if (crawl.value.player1.wins >= totalDuels.value / 2) return crawl.value.player1.name
  if (crawl.value.player2.wins >= totalDuels.value / 2) return crawl.value.player2.name
  return null
})

const headerText = computed(() => {
  if (isSpectator.value) {
    return winner.value ? 'Incredible 🤯' : 'Umm... 🤔'
  }
  if (playerWins.value) {
    return 'Congratulations 🎉'
  } else if (opponentWins.value) {
    return 'Unlucky ☹️'
  } else {
    return 'Umm... 🤔'
  }
})

const bodyText = computed(() => {
  if (isSpectator.value) {
    return winner.value ? `${winner.value} won the crawl, they are a Yugi Master!` : 'The crawl is still in progress.'
  }
  if (playerWins.value) {
    return "You won the crawl, you're now a Yugi Master!"
  } else if (opponentWins.value) {
    return "You lost the crawl, you'll get em next time!"
  } else {
    return 'The crawl is still in progress.'
  }
})
</script>
