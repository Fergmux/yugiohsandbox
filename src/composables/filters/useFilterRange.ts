import type { Ref } from 'vue'
import { ref } from 'vue'

import type { FilterStateBase } from '@/types/filters'

interface FilterRangeState extends FilterStateBase {
  /**
   * Minimum value in the range
   */
  selected: Ref<{ min: number; max: number }>
}

export function useFilterRange(options: { min: number; max: number }): FilterRangeState {
  const selected = ref<{ min: number; max: number }>({
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
