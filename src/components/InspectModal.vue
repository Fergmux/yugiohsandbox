<script setup lang="ts">
import type { YugiohCard } from '@/types'
import { getS3ImageUrl } from '@/utils'
import { useOptimalGrid } from '@/utils/useOptimalGrid'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import InspectModal from './InspectModal.vue'

const props = defineProps<{
  cards?: YugiohCard[]
  selectedIndex?: number
  // actions?: false | string[]
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', index: number): void
  // (e: 'action', name: string): void
}>()

const cardLength = computed(() => props.cards?.length ?? 0)

const { gridStyle } = useOptimalGrid(cardLength)

const selectedCard = ref<YugiohCard[] | undefined>(undefined)

onMounted(() => {
  window.addEventListener('keyup', handleKeyUp, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keyup', handleKeyUp, true)
})

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="cards" @click="emit('close')" class="fixed top-0 left-0 z-[1000] h-screen w-screen">
      <div
        class="h-max-content absolute top-1/2 left-1/2 grid w-full -translate-x-1/2 -translate-y-1/2 gap-2 overflow-auto p-32"
        :style="cards?.length > 1 ? gridStyle : 'grid-template-columns: 1fr;'"
      >
        <img
          v-for="(card, index) in cards"
          :key="card.id"
          :src="getS3ImageUrl(card.id)"
          class="m-auto"
          @click.right.prevent="cards?.length > 1 && (selectedCard = [card])"
          @click.stop="emit('select', index)"
          @dragstart.prevent=""
          :class="{
            'border-4 border-yellow-200': index === selectedIndex,
          }"
        />
        <!-- <div
          class="absolute top-0 left-0 z-[110] flex h-full w-full items-end justify-center opacity-0 hover:opacity-100"
        >
          <div v-if="actions">
            <button
              v-for="action in actions"
              :key="action"
              @click.stop="emit('action', action)"
              class="m-2 rounded-md border-1 border-gray-300 bg-gray-400 p-2 text-black"
            >
              {{ action }}
            </button>
          </div>
        </div> -->
      </div>
    </div>
    <inspect-modal v-if="selectedCard" :cards="selectedCard" @close="selectedCard = undefined" />
  </Teleport>
</template>
