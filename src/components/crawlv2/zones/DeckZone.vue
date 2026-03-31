<template>
    <ZoneBase :name="name" :card="card" :id="id" class="bg-amber-800/75 aspect-2/3" />
</template>

<script setup lang="ts">
import ZoneBase from './ZoneBase.vue'
import type { Card } from '@/types/crawlv2'

const props = defineProps<{
    name: string
    card: Card
    id: string
}>()
</script>