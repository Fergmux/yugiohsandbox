<script setup lang="ts">
import FilterSectionWrapper from './FilterSectionWrapper.vue'

defineProps<{
  options?: { min: number; max: number }
}>()

const emit = defineEmits(['reset'])

const selected = defineModel<{ min: number; max: number }>({ required: true })

const shown = defineModel('shown', { default: true })
const locked = defineModel('locked', { default: false })
</script>

<template>
  <FilterSectionWrapper
    @action="emit('reset')"
    v-model:shown="shown"
    v-model:locked="locked"
    :range="selected"
    :default-range="options"
  >
    <template #title>
      <slot />
    </template>
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <label>Min:</label>
        <input
          type="number"
          v-model="selected.min"
          class="w-20 rounded-md border-1 border-gray-300 p-1"
        />
      </div>
      <div class="flex items-center gap-2">
        <label>Max:</label>
        <input
          type="number"
          v-model="selected.max"
          class="w-20 rounded-md border-1 border-gray-300 p-1"
        />
      </div>
    </div>
  </FilterSectionWrapper>
</template>
