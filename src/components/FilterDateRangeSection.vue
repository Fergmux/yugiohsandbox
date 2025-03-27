<script setup lang="ts">
import FilterSectionWrapper from './FilterSectionWrapper.vue'

defineProps<{
  minLabel?: string
  maxLabel?: string
  defaultRange?: [string, string]
}>()

const emit = defineEmits(['reset'])

const min = defineModel<string>('min', { required: true })
const max = defineModel<string>('max', { required: true })

const hidden = defineModel('hidden', { default: true })
</script>

<template>
  <FilterSectionWrapper
    @action="emit('reset')"
    v-model="hidden"
    :default-range="defaultRange"
    :range="[min, max]"
  >
    <template #title>
      <slot />
    </template>
    <div class="flex items-center gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <label>{{ minLabel || 'Min' }}:</label>
        <input type="date" v-model="min" class="rounded-md border-1 border-gray-300 p-1" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label>{{ maxLabel || 'Max' }}:</label>
        <input type="date" v-model="max" class="rounded-md border-1 border-gray-300 p-1" />
      </div>
    </div>
  </FilterSectionWrapper>
</template>
