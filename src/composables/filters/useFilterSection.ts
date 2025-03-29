import type { Ref } from 'vue'
import { ref } from 'vue'

import type { FilterStateBase } from '@/types/filters'

interface FilterSectionState extends FilterStateBase {
  /**
   * Currently selected values
   */
  selected: Ref<string[]>
}

export function useFilterSection(options: string[]): FilterSectionState {
  const defaultOptions = [...options]
  const selected = ref<string[]>(defaultOptions) as Ref<string[]>
  const locked = ref(false)
  const shown = ref(false)

  const reset = () => {
    if (!locked.value) {
      selected.value = [...defaultOptions]
    }
  }

  const unlock = () => {
    locked.value = false
  }

  const show = (show: boolean) => {
    shown.value = show
  }

  // const toggle = () => {
  //   if (locked.value) return

  //   if (selected.value.length === options.length) {
  //     selected.value = []
  //   } else {
  //     selected.value = [...defaultOptions]
  //   }
  // }

  return {
    selected,
    locked,
    shown,
    reset,
    unlock,
    show,
  }
}
