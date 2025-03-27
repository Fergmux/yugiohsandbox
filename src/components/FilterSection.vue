<script setup lang="ts">
import FilterSectionWrapper from './FilterSectionWrapper.vue'
import Selectlist from './SelectList.vue'

const props = defineProps<{
  options: string[]
}>()

const selected = defineModel<string[]>({ required: true })

const hidden = defineModel('hidden', { default: true })

const selectAll = () => {
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
    v-model="hidden"
  >
    <template #title>
      <slot />
    </template>
    <template #action>
      {{ selected.length !== options.length ? 'Select all' : 'Deselect all' }}
    </template>
    <Selectlist v-model="selected" :options="options" />
  </FilterSectionWrapper>
</template>
