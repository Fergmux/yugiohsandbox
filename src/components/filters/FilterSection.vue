<script setup lang="ts">
import Selectlist from '@/components/SelectList.vue'

import FilterSectionWrapper from './FilterSectionWrapper.vue'

const props = defineProps<{
  options: string[]
}>()

const selected = defineModel<string[]>({ required: true })

const shown = defineModel('shown', { default: true })
const locked = defineModel('locked', { default: false })

const selectAll = () => {
  if (locked.value) return
  if (selected.value.length === props.options.length) {
    selected.value = []
  } else {
    selected.value = props.options
  }
}
</script>

<template>
  <FilterSectionWrapper
    :options="options"
    :selected="selected.length"
    :total="options.length"
    @action="selectAll"
    v-model:shown="shown"
    v-model:locked="locked"
  >
    <template #title> <slot /></template>
    <template #action>
      {{ selected.length !== options.length ? 'Select all' : 'Deselect all' }}
    </template>
    <Selectlist v-model="selected" :options="options" />
  </FilterSectionWrapper>
</template>
