import { computed, ref } from 'vue'

import { defineStore } from 'pinia'

import type { Power } from '@/types/crawl'
import type { Deck } from '@/types/deck'

const ADMIN_ID = 'k42xZxnDK6KhbBYuEiI1'

export const useCrawlStore = defineStore('crawl', () => {
  const adminDecks = ref<Deck[]>([])
  const powerRewards = ref<Power[]>([])

  const rewardDecks = computed(() => adminDecks.value.filter((deck) => deck.type === 'reward'))
  const starterDecks = computed(() => adminDecks.value.filter((deck) => deck.type === 'starter'))

  const getPowers = async () => {
    const response = await fetch(`/.netlify/functions/get-powers`)
    const data = await response.json()
    powerRewards.value = data
  }

  const getAdminDecks = async () => {
    const response = await fetch(`/.netlify/functions/get-decks/${ADMIN_ID}`)
    const data = await response.json()
    adminDecks.value = data
  }

  return {
    adminDecks,
    rewardDecks,
    starterDecks,
    powerRewards,
    getPowers,
    getAdminDecks,
  }
})
