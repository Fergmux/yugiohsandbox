<script setup lang="ts">
import FilterSectionWrapper from './FilterSectionWrapper.vue'

defineProps<{
  minLabel?: string
  maxLabel?: string
  defaultRange?: [number, number]
}>()

const emit = defineEmits(['reset'])

const min = defineModel<number>('min', { required: true })
const max = defineModel<number>('max', { required: true })

const hidden = defineModel('hidden', { default: true })
</script>

<template>
  <FilterSectionWrapper
    @action="emit('reset')"
    v-model="hidden"
    :range="[min, max]"
    :default-range="defaultRange"
  >
    <template #title>
      <slot />
    </template>
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <label>{{ minLabel || 'Min' }}:</label>
        <input type="number" v-model="min" class="w-20 rounded-md border-1 border-gray-300 p-1" />
      </div>
      <div class="flex items-center gap-2">
        <label>{{ maxLabel || 'Max' }}:</label>
        <input type="number" v-model="max" class="w-20 rounded-md border-1 border-gray-300 p-1" />
      </div>
    </div>
  </FilterSectionWrapper>
</template>
