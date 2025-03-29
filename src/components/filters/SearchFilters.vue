<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { storeToRefs } from 'pinia'

import FilterDateRangeSection from '@/components/filters/FilterDateRangeSection.vue'
import FilterRangeSection from '@/components/filters/FilterRangeSection.vue'
import FilterSection from '@/components/filters/FilterSection.vue'
import FilterSectionsSection from '@/components/filters/FilterSectionsSection.vue'
import FilterSectionWrapper from '@/components/filters/FilterSectionWrapper.vue'
import { useFilterDateRange } from '@/composables/filters/useFilterDateRange'
import { useFilterRange } from '@/composables/filters/useFilterRange'
import { useFilterSection } from '@/composables/filters/useFilterSection'
import { useFilterSections } from '@/composables/filters/useFilterSections'
import { useDeckStore } from '@/stores/deck'
import {
  attributeOptions,
  banlistOptions,
  cardTypeSections as cardTypeOptions,
  defaultAtkRange,
  defaultDefRange,
  defaultLevelRange,
  defaultOcgReleaseDateRange,
  defaultTcgReleaseDateRange,
  type FilterOption,
  formatOptions,
  frameTypeOptions,
  pendulumFrameTypeOptions,
  raceSections as raceOptions,
} from '@/types/filters'
import type { BanlistInfo, MiscInfoDates, YugiohCard, YugiohCardNumbers, YugiohCardStrings } from '@/types/yugiohCard'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === 'string')
}

//----- STORE -----//
const deckStore = useDeckStore()
const { allCards } = storeToRefs(deckStore)

//----- CONFIG -----//
type sectionType = 'section' | 'sections' | 'range' | 'date'
const sectionTypes: Record<
  string,
  {
    type: sectionType
    options: string[] | FilterOption[] | { min: number; max: number } | { min: string; max: string }
    title: string
  }
> = {
  frameType: { type: 'section', options: frameTypeOptions, title: 'Frame Type' },
  cardType: { type: 'sections', options: cardTypeOptions, title: 'Card Type' },
  race: { type: 'sections', options: raceOptions, title: 'Race' },
  attribute: { type: 'section', options: attributeOptions, title: 'Attribute' },
  banlistGoat: { type: 'section', options: banlistOptions, title: 'GOAT Banlist' },
  banlistOcg: { type: 'section', options: banlistOptions, title: 'OCG Banlist' },
  banlistTcg: { type: 'section', options: banlistOptions, title: 'TCG Banlist' },
  format: { type: 'section', options: formatOptions, title: 'Format' },
  level: { type: 'range', options: defaultLevelRange, title: 'Level' },
  atk: { type: 'range', options: defaultAtkRange, title: 'Attack' },
  def: { type: 'range', options: defaultDefRange, title: 'Defense' },
  ocgReleaseDate: { type: 'date', options: defaultOcgReleaseDateRange, title: 'OCG Release Date' },
  tcgReleaseDate: { type: 'date', options: defaultTcgReleaseDateRange, title: 'TCG Release Date' },
  archetype: { type: 'section', options: [], title: 'Archetype' },
}

const sectionTypeFunctionMap = {
  section: { composable: useFilterSection, component: FilterSection },
  sections: { composable: useFilterSections, component: FilterSectionsSection },
  range: { composable: useFilterRange, component: FilterRangeSection },
  date: { composable: useFilterDateRange, component: FilterDateRangeSection },
}

const filters = Object.fromEntries(
  Object.entries(sectionTypes).map(([key, section]) => {
    return [
      key,
      {
        // @ts-expect-error - the maps above ensure correct type matching
        filter: reactive(sectionTypeFunctionMap[section.type].composable(section.options)),
        title: section.title,
        options: section.options,
        is: sectionTypeFunctionMap[section.type].component,
      },
    ]
  }),
)

const sections = computed(() => Object.entries(filters).map(([key, section]) => ({ ...section, key })))

const frameTypeSearch = computed(() =>
  (filters.frameType.filter.selected as string[])
    .map((frameType: string) => (frameType === 'Pendulum' ? pendulumFrameTypeOptions : frameType))
    .flat(),
)

//----- ARCHETYPES -----//
const archetypes = computed(() => {
  const archetypeSet = new Set<string>()
  allCards.value.forEach((card) => {
    if (card.archetype) {
      archetypeSet.add(card.archetype)
    }
  })
  return archetypeSet
})
const archetypeSearch = ref('')
const archetypeFilterShown = ref(false)
const filteredArchetypes = computed(() => {
  return Array.from(archetypes.value).filter(
    (archetype) => archetypeSearch.value && archetype.toLowerCase().includes(archetypeSearch.value.toLowerCase()),
  )
})
const selectedArchetypes = ref<string[]>([])
const addArchetype = (archetype: string) => {
  archetypeSearch.value = ''
  selectedArchetypes.value.push(archetype)
}
const removeArchetype = (archetype: string) => {
  selectedArchetypes.value = selectedArchetypes.value.filter((a) => a !== archetype)
}
const highlightedIndex = ref(-1)
const navigateDropdown = (direction: number) => {
  highlightedIndex.value += direction
  if (highlightedIndex.value < 0) highlightedIndex.value = 0
  if (highlightedIndex.value >= filteredArchetypes.value.length)
    highlightedIndex.value = filteredArchetypes.value.length - 1
}
const selectHighlightedArchetype = () => {
  if (highlightedIndex.value >= 0 && highlightedIndex.value < filteredArchetypes.value.length) {
    addArchetype(filteredArchetypes.value[highlightedIndex.value])
  }
}

const archetypeFilterLocked = ref(false)
const resetArchetypes = () => {
  if (!archetypeFilterLocked.value) {
    selectedArchetypes.value = []
  }
}

//----- RESET -----//
const resetFilters = () => {
  sections.value.forEach((section) => {
    section.filter.reset()
  })
  resetArchetypes()
}

//----- UNLOCK -----//
const unlockAllFilters = () => {
  sections.value.forEach((section) => {
    section.filter.unlock()
  })
}

//----- SHOW -----//
const showPriority = computed(() => {
  return !sections.value.some((section) => {
    const shown = section.filter.shown
    // If any section is shown, return true (which means we should collapse)
    if (shown === true) return true
    // If any nested section is shown, return true (which means we should collapse)
    if (typeof shown === 'object' && Object.values(shown).some((v) => v === true)) return true
    // Otherwise all sections are hidden, so we should expand
    return false
  })
})

const showAllFilters = () => {
  const show = showPriority.value
  sections.value.forEach((section) => {
    section.filter.show(show)
  })
}

type SelectedType = string[] | { min: number; max: number } | { min: string; max: string }
const assertedArrayIncludes =
  (
    selected: SelectedType,
    { key, banlistKey, value }: { key?: keyof YugiohCardStrings; banlistKey?: keyof BanlistInfo; value?: string },
  ) =>
  (card: YugiohCard) => {
    if (!isStringArray(selected)) return false
    if (key) return selected.includes(card[key] ?? '')
    if (banlistKey) return selected.includes(card.banlist_info?.[banlistKey] ?? '')
    if (value) return selected.includes(value)
  }

const assertedInRange =
  (selected: SelectedType, { numKey, dateKey }: { numKey?: keyof YugiohCardNumbers; dateKey?: keyof MiscInfoDates }) =>
  (card: YugiohCard) => {
    const { min, max } = Array.isArray(selected) ? {} : selected
    // Number comparison
    if (numKey && card[numKey] && card[numKey] >= 0 !== undefined) {
      if (typeof min === 'number' && typeof max === 'number') return card[numKey] >= min && card[numKey] <= max
      if (typeof max === 'number') return card[numKey] <= max
      if (typeof min === 'number') return card[numKey] >= min
    }

    // Date comparison
    const info = card.misc_info[0]
    if (dateKey && info[dateKey]) {
      if (typeof min === 'string' && typeof max === 'string')
        return new Date(info[dateKey]) >= new Date(min) && new Date(info[dateKey]) <= new Date(max)
      if (typeof max === 'string') return new Date(info[dateKey]) <= new Date(max)
      if (typeof min === 'string') return new Date(info[dateKey]) >= new Date(min)
    }
    return true
  }

const filteredCards = computed<YugiohCard[]>(() => {
  return allCards.value
    .filter(assertedArrayIncludes(filters.cardType.filter.selected, { key: 'type' }))
    .filter(assertedArrayIncludes(frameTypeSearch.value, { key: 'frameType' }))
    .filter(assertedArrayIncludes(filters.race.filter.selected, { key: 'race' }))
    .filter(
      (card) => assertedArrayIncludes(filters.attribute.filter.selected, { key: 'attribute' })(card) || !card.attribute,
    )
    .filter(
      (card) =>
        card.misc_info[0].formats.some((format) =>
          assertedArrayIncludes(filters.format.filter.selected, { value: format })(card),
        ) ||
        (card.misc_info[0].formats.length === 0 &&
          assertedArrayIncludes(filters.format.filter.selected, { value: 'No Format' })),
    )
    .filter(
      (card) =>
        assertedArrayIncludes(filters.banlistGoat.filter.selected, { banlistKey: 'ban_goat' }) ||
        (assertedArrayIncludes(filters.banlistGoat.filter.selected, { value: 'Allowed' }) &&
          !card.banlist_info?.ban_goat) ||
        assertedArrayIncludes(filters.banlistOcg.filter.selected, { banlistKey: 'ban_ocg' }) ||
        (assertedArrayIncludes(filters.banlistOcg.filter.selected, { value: 'Allowed' }) &&
          !card.banlist_info?.ban_ocg) ||
        assertedArrayIncludes(filters.banlistTcg.filter.selected, { banlistKey: 'ban_tcg' }) ||
        (assertedArrayIncludes(filters.banlistTcg.filter.selected, { value: 'Allowed' }) &&
          !card.banlist_info?.ban_tcg),
    )
    .filter(assertedInRange(filters.level.filter.selected, { numKey: 'level' }))
    .filter(assertedInRange(filters.atk.filter.selected, { numKey: 'atk' }))
    .filter(assertedInRange(filters.def.filter.selected, { numKey: 'def' }))
    .filter(assertedInRange(filters.ocgReleaseDate.filter.selected, { dateKey: 'ocg_date' }))
    .filter(assertedInRange(filters.tcgReleaseDate.filter.selected, { dateKey: 'tcg_date' }))
    .filter((card) => selectedArchetypes.value.length === 0 || selectedArchetypes.value.includes(card.archetype ?? ''))
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: YugiohCard[]): void
}>()

// Watch for changes in filteredCards and emit update
watch(filteredCards, (newValue) => {
  emit('update:modelValue', newValue)
})
</script>
<template>
  <div class="mb-4 w-full rounded-md border-1 border-gray-300 px-2 py-4">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex cursor-pointer gap-1" @click="showAllFilters">
        <button class="material-symbols-outlined cursor-pointer" :title="showPriority ? 'Expand all' : 'Collapse all'">
          {{ showPriority ? 'expand_all' : 'collapse_all' }}
        </button>
        <h3 class="text-2xl font-semibold">Filters</h3>
      </div>
      <div class="flex gap-2">
        <button @click="unlockAllFilters" class="material-symbols-outlined cursor-pointer" title="Unlock all">
          lock_open
        </button>
        <button @click="resetFilters" class="material-symbols-outlined cursor-pointer" title="Reset all">
          refresh
        </button>
      </div>
    </div>
    <!-- @vue-ignore -->
    <component
      v-for="section in sections"
      :key="section.key"
      :is="section.is"
      :options="section.options"
      v-model="section.filter.selected"
      v-model:shown="section.filter.shown"
      v-model:locked="section.filter.locked"
    >
      {{ section.title }}
    </component>
    <FilterSectionWrapper
      v-model="selectedArchetypes.length"
      :selected="selectedArchetypes.length"
      @action="resetArchetypes"
      v-model:locked="archetypeFilterLocked"
      v-model:shown="archetypeFilterShown"
    >
      <template #title>Archetypes</template>
      <input
        type="text"
        v-model="archetypeSearch"
        placeholder="Search for archetypes..."
        class="w-full rounded-md border-1 border-gray-300 p-2"
        @keydown.down.prevent="navigateDropdown(1)"
        @keydown.up.prevent="navigateDropdown(-1)"
        @keydown.enter.prevent="selectHighlightedArchetype"
      />
      <div v-if="filteredArchetypes.length" class="relative">
        <ul
          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-neutral-900 shadow-lg"
        >
          <li
            v-for="(archetype, index) in filteredArchetypes"
            :key="archetype"
            @click="addArchetype(archetype)"
            class="cursor-pointer px-4 py-2"
            :class="{
              'bg-neutral-600': highlightedIndex === index,
              'hover:bg-neutral-600': highlightedIndex !== index,
            }"
          >
            {{ archetype }}
          </li>
        </ul>
      </div>
      <div v-if="selectedArchetypes.length" class="mt-2 flex flex-wrap gap-2">
        <div
          v-for="archetype in selectedArchetypes"
          :key="archetype"
          @click="removeArchetype(archetype)"
          class="flex cursor-pointer items-center gap-1 rounded-md border-1 border-gray-300 p-2 text-sm"
        >
          <span class="material-symbols-outlined !text-sm">close</span>
          <span>{{ archetype }}</span>
        </div>
      </div>
    </FilterSectionWrapper>
  </div>
</template>
