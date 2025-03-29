<script setup lang="ts">
import FilterSectionWrapper from '../filters/FilterSectionWrapper.vue'

defineProps<{
  options?: { min: string; max: string }
}>()

const emit = defineEmits(['reset'])

const selected = defineModel<{ min: string; max: string }>({ required: true })

const shown = defineModel('shown', { default: true })
const locked = defineModel('locked', { default: false })
</script>

<template>
  <FilterSectionWrapper
    @action="emit('reset')"
    v-model:shown="shown"
    :default-range="options"
    :range="selected"
    :locked="locked"
  >
    <template #title>
      <slot />
    </template>
    <div class="flex items-center gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <label>Min:</label>
        <input type="date" v-model="selected.min" class="rounded-md border-1 border-gray-300 p-1" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label>Max:</label>
        <input type="date" v-model="selected.max" class="rounded-md border-1 border-gray-300 p-1" />
      </div>
    </div>
  </FilterSectionWrapper>
</template>
