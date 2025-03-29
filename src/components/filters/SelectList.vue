<script setup lang="ts">
import { computed } from 'vue'
import SelectButton from './SelectButton.vue'

const props = defineProps<{
  options: string[]
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const selectedValues = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const toggleOption = (option: string) => {
  const newSelected = [...selectedValues.value]
  const index = newSelected.indexOf(option)

  if (index === -1) {
    newSelected.push(option)
  } else {
    newSelected.splice(index, 1)
  }

  selectedValues.value = newSelected
}

const isSelected = (option: string) => selectedValues.value.includes(option)
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <SelectButton
      v-for="option in options"
      :key="option"
      :value="option"
      :selected="isSelected(option)"
      @click="toggleOption(option)"
    >
      {{ option }}
    </SelectButton>
  </div>
</template>
