import type { Ref } from 'vue'
import { ref } from 'vue'

import type { FilterStateBase } from '@/types/filters'

interface FilterDateRangeState extends FilterStateBase {
  /**
   * Minimum date in the range (YYYY-MM-DD format)
   */
  selected: Ref<{ min: string; max: string }>
}

export function useFilterDateRange(options: { min: string; max: string }): FilterDateRangeState {
  const selected = ref<{ min: string; max: string }>({
    min: options.min,
    max: options.max,
  })
  const locked = ref(false)
  const shown = ref(false)

  const reset = () => {
    if (!locked.value) {
      selected.value = {
        min: options.min,
        max: options.max,
      }
    }
  }

  const unlock = () => {
    locked.value = false
  }

  const show = (show: boolean) => {
    shown.value = show
  }

  return {
    selected,
    locked,
    shown,
    reset,
    unlock,
    show,
  }
}
