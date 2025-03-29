# useFilterSection Composable

A Vue 3 composable for creating and managing filter sections with selectable options.

## Usage

```typescript
import { useFilterSection } from '@/composables/filters/useFilterSection'

// Define your filter options
const attributeOptions = ['DARK', 'DIVINE', 'EARTH', 'FIRE', 'LIGHT', 'WATER', 'WIND']

// Create your filter
const attributeFilter = useFilterSection({
  defaultValues: attributeOptions, // Initially selected values
  options: attributeOptions, // All available options
  isShown: false, // Initially collapsed (optional)
  isLocked: false, // Initially unlocked (optional)
})

// Use the filter in your component
const { selected, locked, shown, reset, selectAll } = attributeFilter

// Access values
console.log(selected.value) // Array of currently selected options

// Check if filter is locked before making changes
if (!locked.value) {
  selected.value = ['DARK', 'LIGHT'] // Update selection
}

// Reset to default values
reset()

// Toggle between all selected and none selected
selectAll()
```

## Integration with FilterSection Component

To use with the existing FilterSection component:

```vue
<template>
  <FilterSection
    :options="attributeOptions"
    v-model="attributeFilter.selected.value"
    v-model:shown="attributeFilter.shown.value"
    v-model:locked="attributeFilter.locked.value"
    @reset="attributeFilter.reset"
  >
    Attributes
  </FilterSection>
</template>
```

## TypeScript Interface

```typescript
interface FilterSectionState<T> {
  selected: Ref<T[]> // Currently selected values
  locked: Ref<boolean> // Whether the filter is locked
  shown: Ref<boolean> // Whether the filter is expanded/shown
  reset: () => void // Reset to default values if not locked
  selectAll: () => void // Toggle between all/none if not locked
}
```
