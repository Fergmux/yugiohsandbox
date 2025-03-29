import type { Ref } from 'vue'
import { ref } from 'vue'

import type { FilterOption, FilterStateBaseBase } from '@/types/filters'

// Recursively extract all options from nested sections
const getAllOptions = (sections: FilterOption[]): string[] => {
  const allOptions: string[] = []

  const extractOptions = (sections: FilterOption[]) => {
    for (const section of sections) {
      if (typeof section === 'string') {
        allOptions.push(section)
      } else if (section.options) {
        extractOptions(section.options)
      }
    }
  }

  extractOptions(sections)
  return allOptions
}

// Generate a map of section paths to boolean values (shown/collapsed)
const generateSectionsMap = (sections: FilterOption[], value: boolean, path: string = '0'): Record<string, boolean> => {
  const result: Record<string, boolean> = {}

  // Set the value for the current path
  result[path] = value

  // Process nested sections
  sections.forEach((section, index) => {
    if (typeof section !== 'string' && section.options) {
      const newPath = `${path}.${index}`
      const nestedResult = generateSectionsMap(section.options, value, newPath)
      Object.assign(result, nestedResult)
    }
  })

  return result
}

// Helper function to collect types from sections
const getTypesFromSection = (section: FilterOption): string[] => {
  if (typeof section === 'string') return [section]
  return section.options.flatMap((opt) => (typeof opt === 'string' ? [opt] : getTypesFromSection(opt)))
}

const processLockedSections = (
  sections: FilterOption[],
  locked: Record<string, boolean>,
  path: string = '0',
  hasLockedParent: boolean = false,
) => {
  const lockedTypes: string[] = []
  sections.forEach((section, index) => {
    if (typeof section === 'string') return

    const currentPath = `${path}.${index}`
    const isCurrentLocked = locked[currentPath] || hasLockedParent

    // If this section or any parent is locked, add all its types
    if (isCurrentLocked) {
      lockedTypes.push(...getTypesFromSection(section))
    } else if (section.options && section.options.length > 0) {
      // If not locked, recursively check its children
      lockedTypes.push(...processLockedSections(section.options, locked, currentPath, false))
    }
  })
  return lockedTypes
}

interface FilterSectionsState extends FilterStateBaseBase {
  /**
   * Currently selected values
   */
  selected: Ref<string[]>
  /**
   * Whether the filter section is locked (per section path)
   */
  locked: Ref<Record<string, boolean>>
  /**
   * Whether the filter section is shown/expanded (per section path)
   */
  shown: Ref<Record<string, boolean>>
}

export function useFilterSections(options: FilterOption[]): FilterSectionsState {
  const defaultValues = getAllOptions(options)
  const selected: Ref<string[]> = ref(defaultValues)
  const locked: Ref<Record<string, boolean>> = ref({})
  const shown: Ref<Record<string, boolean>> = ref({})

  // Helper to toggle all sections open or closed
  const show = (show: boolean) => {
    shown.value = generateSectionsMap(options, show)
  }

  // Extract all locked sections and only reset unlocked types
  const reset = () => {
    const allOptions = getAllOptions(options)

    // Start the recursive processing
    const lockedTypes = processLockedSections(options, locked.value)

    // Reset only unlocked types
    const unlockedTypes = allOptions.filter((type) => !lockedTypes.includes(type))

    // Keep selected locked types and add all unlocked types
    selected.value = [...selected.value.filter((type) => lockedTypes.includes(type)), ...unlockedTypes]
  }

  const unlock = () => {
    Object.keys(locked.value).forEach((key) => {
      locked.value[key] = false
    })
  }

  return {
    selected,
    locked,
    shown,
    unlock,
    show,
    reset,
  }
}
