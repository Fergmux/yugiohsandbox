<template>
  <CardBase v-if="card" :card="card" />
</template>

<script setup lang="ts">
import CardBase from './CardBase.vue'
import { type GameCard } from '@/types/cards'

defineProps<{
  card?: GameCard | null
}>()
</script>
