<script setup lang="ts">
import { type FilterOption, type FilterSection } from '@/types'
import type { ComputedRef } from 'vue'
import { computed, reactive } from 'vue'
import FilterSectionWrapper from './FilterSectionWrapper.vue'
import Selectlist from './SelectList.vue'

const props = defineProps<{
  sections: FilterOption[]
  depth: number
}>()

const selected = defineModel<string[]>({ required: true })
const hidden = defineModel('hidden', { default: true })

// Local state to track individual section visibility
const localHiddenSections = reactive<Record<string, boolean>>({})

function selectAll() {
  // Get all possible options from all sections
  const totalSectionStrings = getStringsFromSections(props.sections)

  // Check if all options are already selected
  const allSelected = totalSectionStrings.every((option) => selected.value.includes(option))

  if (allSelected) {
    // Deselect all if everything is already selected
    selected.value = []
  } else {
    // Otherwise select all options
    selected.value = totalSectionStrings
  }
}

const stringValues = computed(() => {
  return props.sections.filter((section) => typeof section === 'string') as string[]
})

const sectionValues = computed(() => {
  return props.sections.filter((section) => typeof section !== 'string') as FilterSection[]
})

const selectedStrings = computed({
  get: () => stringValues.value.filter((value) => selected.value.includes(value)),
  set: (newValue) => {
    // Combine all selected strings from all sections
    const allSectionStrings = Object.values(sectionComputedProps.value).flatMap(
      (computed) => computed.value,
    )
    selected.value = [...newValue, ...allSectionStrings]
  },
})

// Helper function to get all string options from a section
const getStringsFromSections = (sections: FilterOption[]): string[] => {
  const strings = sections.filter((option) => typeof option === 'string') as string[]
  const objects = sections.filter((option) => typeof option !== 'string') as FilterSection[]
  const nestedStrings = objects.flatMap((object) => getStringsFromSections(object.options))
  return [...strings, ...nestedStrings]
}

// Create a computed property for each section
const sectionComputedProps = computed(() => {
  return sectionValues.value.reduce(
    (acc, section, index) => {
      acc[index] = computed({
        get: () => {
          const sectionStrings = getStringsFromSections([section])
          return sectionStrings.filter((value) => selected.value.includes(value))
        },
        set: (newValue: string[]) => {
          // Get all strings from other sections
          const otherSections = sectionValues.value.filter((_, i) => i !== index)
          const otherSectionStrings = getStringsFromSections(otherSections)
          const otherSelectedStrings = otherSectionStrings.filter((value) =>
            selected.value.includes(value),
          )
          const removedStrings = section.options.filter(
            (value) => typeof value === 'string' && !newValue.includes(value),
          )

          // Combine with string values and other section selections
          selected.value = [...newValue, ...selectedStrings.value, ...otherSelectedStrings].filter(
            (value) => !removedStrings.includes(value),
          )
        },
      })
      return acc
    },
    {} as Record<number, ComputedRef<string[]>>,
  )
})

const totalStrings = computed(() => [...new Set(getStringsFromSections(props.sections))].length)
const totalSelected = computed(() => [...new Set(selected.value)].length)
</script>

<template>
  <FilterSectionWrapper
    v-model="hidden"
    @action="selectAll"
    :selected="totalSelected"
    :total="totalStrings"
    :depth
  >
    <template #title>
      <slot />
    </template>
    <template #action>
      {{ totalSelected !== totalStrings ? 'Select all' : 'Deselect all' }}
    </template>
    <div>
      <Selectlist v-model="selectedStrings" :options="stringValues" />
      <div v-for="(section, index) in sectionValues" :key="section.title + index" class="mt-2">
        <FilterSectionsSection
          :depth="depth + 1"
          v-model="sectionComputedProps[index].value"
          :sections="section.options"
          v-model:hidden="localHiddenSections[section.title]"
        >
          {{ section.title }}
        </FilterSectionsSection>
      </div>
    </div>
  </FilterSectionWrapper>
</template>
