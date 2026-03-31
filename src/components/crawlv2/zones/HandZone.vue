<template>
    <ZoneBase :name="name" :card="card" :id="id" class="bg-gray-300/25" />
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