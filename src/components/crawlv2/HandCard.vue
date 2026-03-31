<template>
    <CardBase :card="card" />
</template>

<script setup lang="ts">
import CardBase from './CardBase.vue'
import type { Card } from '@/types/crawlv2'

const props = defineProps<{
    card: Card
}>()
</script>
