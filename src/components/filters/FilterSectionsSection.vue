<script setup lang="ts">
import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import Selectlist from '@/components/SelectList.vue'
import {
  type FilterOption,
  type FilterSection,
} from '@/types'

import FilterSectionWrapper from './FilterSectionWrapper.vue'

const props = defineProps<{
  sections: FilterOption[]
  depth: string // String of the form "index.index.index" representing the path to this section
}>()

const selected = defineModel<string[]>({ required: true })
const shown = defineModel<boolean | Record<string, boolean>>('shown', { default: false })

// Use depth as the key for locked state
const locked = defineModel<Record<string, boolean>>('locked', { default: () => ({}) })
// Computed property to check if any locked values for depths greater than current depth exist
const hasLockedChildren = computed(() => {
  // If locked is a boolean, it doesn't have depth information
  if (typeof locked.value !== 'object') {
    return false
  }

  // Get the current depth level
  const currentDepthParts = props.depth ? props.depth.split('.') : []
  const currentDepthLength = currentDepthParts.length

  // Check if any depth greater than current depth is locked
  return Object.entries(locked.value).some(([key, value]) => {
    if (!value) return false

    // Check if the key is a child path of the current depth
    const keyParts = key.split('.')
    if (keyParts.length > currentDepthLength) {
      // Check if this is a child path of the current depth
      const isChildPath = currentDepthParts.every((part, i) => part === keyParts[i])
      return isChildPath
    }

    return false
  })
})

// Helper to get current shown state
const currentShown = computed({
  get: () => {
    if (typeof shown.value === 'boolean') {
      return shown.value
    }
    return shown.value[props.depth] ?? false
  },
  set: (value: boolean) => {
    if (typeof shown.value === 'boolean') {
      shown.value = value
    } else {
      shown.value = { ...shown.value, [props.depth]: value }
    }
  },
})

// Helper to get/set lock state for current section
const currentLock = computed({
  get: () => {
    // Check if current section is locked
    if (locked.value[props.depth]) return true

    // Get the current depth parts
    const currentDepthParts = props.depth ? props.depth.split('.') : []
    const currentDepthLength = currentDepthParts.length

    // Check if any parent depth is locked
    for (const [key, isLocked] of Object.entries(locked.value)) {
      if (!isLocked) continue

      const keyParts = key.split('.')
      if (keyParts.length < currentDepthLength) {
        // Check if this is a parent path of the current depth
        const isParentPath = keyParts.every((part, i) => part === currentDepthParts[i])
        if (isParentPath) return true
      }
    }

    return false
  },
  set: (value: boolean) => {
    locked.value = { ...locked.value, [props.depth]: value }
    setTimeout(() => {
      console.log(locked.value)
    }, 100)
  },
})

// Local state to track individual section visibility
function selectAll() {
  if (currentLock.value) return
  // Get all possible options from all sections
  const totalSectionStrings = getStringsFromSections(props.sections)

  // Check if all options are already selected
  const allSelected = totalSectionStrings.every((option) => selected.value.includes(option))

  // Get all locked child options that should be preserved
  const getLockedChildOptions = () => {
    const lockedOptions: string[] = []
    const lockedDeselectedOptions: string[] = []

    // Helper function to check if a section or its children are locked
    const checkLockedSections = (sections: FilterOption[], path: string = props.depth) => {
      sections.forEach((section, index) => {
        const currentPath = path ? `${path}.${index}` : `${index}`

        // Check if this section is locked
        if (locked.value[currentPath]) {
          // If locked, add all its string options to the preserved list
          if (typeof section === 'string') {
            if (selected.value.includes(section)) {
              lockedOptions.push(section)
            } else {
              lockedDeselectedOptions.push(section)
            }
          } else {
            // For section objects, get all their string options
            const sectionStrings = getStringsFromSections([section])
            sectionStrings.forEach((str) => {
              if (selected.value.includes(str)) {
                lockedOptions.push(str)
              } else {
                lockedDeselectedOptions.push(str)
              }
            })
          }
        } else if (typeof section !== 'string') {
          // If not locked, check its children recursively
          checkLockedSections(section.options, currentPath)
        }
      })
    }

    checkLockedSections(props.sections)
    return { lockedOptions, lockedDeselectedOptions }
  }

  const { lockedOptions, lockedDeselectedOptions } = getLockedChildOptions()

  if (allSelected) {
    // Deselect all except locked options
    selected.value = lockedOptions
  } else {
    // Select all options except those that are locked and deselected
    const optionsToSelect = totalSectionStrings.filter(
      (option) => !lockedDeselectedOptions.includes(option),
    )

    selected.value = optionsToSelect
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
    v-model:shown="currentShown"
    v-model:locked="currentLock"
    @action="selectAll"
    :selected="totalSelected"
    :total="totalStrings"
    :depth="props.depth ? props.depth.split('.').length : 0"
    :has-locked-children="hasLockedChildren"
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
          ref="childSectionRef"
          :depth="props.depth ? `${props.depth}.${index}` : `${index}`"
          v-model="sectionComputedProps[index].value"
          :sections="section.options"
          v-model:shown="shown"
          v-model:locked="locked"
        >
          {{ section.title }}
        </FilterSectionsSection>
      </div>
    </div>
  </FilterSectionWrapper>
</template>
