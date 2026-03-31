<template>
  <ZoneBase :name="name" :card="card" :id="id" rotate class="bg-red-700/75" />
</template>

<script setup lang="ts">
import ZoneBase from './ZoneBase.vue'
import type { Card } from '@/types/crawlv2'

defineProps<{
  name: string
  card: Card
  id: string
}>()
</script>
