<script setup lang="ts">
import { inject, unref } from 'vue'

import type { BanlistFormat, BanlistInfo } from '@/types/yugiohCard'

interface Props {
  banlistInfo?: BanlistInfo
}

const props = defineProps<Props>()
const format = inject<BanlistFormat>('format', 'tcg')
const currentFormat = unref(format)

const banlistStatus = () => props.banlistInfo?.[`ban_${currentFormat}`]
const isForbidden = () => banlistStatus() === 'Forbidden'
const isLimited = () => banlistStatus() === 'Limited'
</script>

<template>
  <div v-if="banlistStatus()" class="absolute top-2 left-2">
    <span v-if="isForbidden()" class="material-symbols-outlined material-thick text-red-600">block</span>
    <span v-else-if="isLimited()" class="material-symbols-outlined material-thick text-yellow-400">warning</span>
  </div>
</template>
