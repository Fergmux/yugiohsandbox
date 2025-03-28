<script setup lang="ts">
import type {
  ComputedRef,
  Ref,
} from 'vue'
import {
  computed,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'

import { debounce } from 'lodash'
import { storeToRefs } from 'pinia'

import DeckSection from '@/components/DeckSection.vue'
import FilterDateRangeSection from '@/components/filters/FilterDateRangeSection.vue'
import FilterRangeSection from '@/components/filters/FilterRangeSection.vue'
import FilterSection from '@/components/filters/FilterSection.vue'
import FilterSectionsSection from '@/components/filters/FilterSectionsSection.vue'
import FilterSectionWrapper from '@/components/filters/FilterSectionWrapper.vue'
import InspectModal from '@/components/InspectModal.vue'
import { useDeckStore } from '@/stores/deck'
import type { YugiohCard } from '@/types'
import {
  effectTypes,
  extraDeckTypes,
  extraTunerTypes,
  type FilterOption,
  fusionTypes,
  linkTypes,
  mainDeckTypes,
  normalTypes,
  otherDeckTypes,
  pendulumTypes,
  ritualTypes,
  synchroTypes,
  tunerTypes,
  xyzTypes,
} from '@/types'
import {
  ArrowPathIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'

const cardTypeSections: FilterOption[] = [
  {
    title: 'Main Deck',
    options: [
      { title: 'Normal Monsters', options: normalTypes },
      { title: 'Effect Monsters', options: effectTypes },
      { title: 'Ritual Monsters', options: ritualTypes },
      { title: 'Tuner Monsters', options: tunerTypes },
      'Spell Card',
      'Trap Card',
    ],
  },
  {
    title: 'Extra Deck',
    options: [
      { title: 'Fusion Monsters', options: fusionTypes },
      { title: 'Synchro Monsters', options: synchroTypes },
      { title: 'XYZ Monsters', options: xyzTypes },
      { title: 'Link Monsters', options: linkTypes },
      { title: 'Pendulum Monsters', options: pendulumTypes },
      { title: 'Extra Tuner Monsters', options: extraTunerTypes },
    ],
  },
  {
    title: 'Other',
    options: ['Token', 'Skill Card'],
  },
]

const cardTypeOptions = [...extraDeckTypes, ...mainDeckTypes, ...otherDeckTypes]
const selectedCardTypes = ref<string[]>(cardTypeOptions)

const frameTypeOptions = [
  'Normal',
  'Effect',
  'Ritual',
  'Fusion',
  'Synchro',
  'XYZ',
  'Link',
  'Pendulum',
  'Spell',
  'Trap',
  'Token',
  'Skill',
]
const pendulumFrameTypeOptions = [
  'normal_pendulum',
  'effect_pendulum',
  'ritual_pendulum',
  'fusion_pendulum',
  'synchro_pendulum',
  'xyz_pendulum',
]
const frameTypeSelected = ref<string[]>(frameTypeOptions)
const frameTypeSearch = computed(() =>
  frameTypeSelected.value
    .map((frameType) => (frameType === 'Pendulum' ? pendulumFrameTypeOptions : frameType))
    .flat(),
)

const monsterRaces = [
  'Aqua',
  'Beast',
  'Beast-Warrior',
  'Creator-God',
  'Cyberse',
  'Dinosaur',
  'Divine-Beast',
  'Dragon',
  'Fairy',
  'Fiend',
  'Fish',
  'Illusion',
  'Insect',
  'Machine',
  'Plant',
  'Psychic',
  'Pyro',
  'Reptile',
  'Rock',
  'Sea Serpent',
  'Spellcaster',
  'Thunder',
  'Warrior',
  'Winged Beast',
  'Wyrm',
  'Zombie',
  'Other',
]
const spellRaces = ['Normal', 'Field', 'Equip', 'Quick-Play', 'Ritual', 'Continuous']
const trapRaces = ['Normal', 'Counter', 'Continuous']

const raceSections: FilterOption[] = [
  { title: 'Monster Cards', options: monsterRaces },
  { title: 'Spell Cards', options: spellRaces },
  { title: 'Trap Cards', options: trapRaces },
]
const raceOptions = [...monsterRaces, ...spellRaces, ...trapRaces]
const selectedRaces = ref<string[]>(raceOptions)

const attributeOptions = ['DARK', 'DIVINE', 'EARTH', 'FIRE', 'LIGHT', 'METAL', 'WATER', 'WIND']
const selectedAttributes = ref<string[]>(attributeOptions)

const banlistOptions = ['Forbidden', 'Limited', 'Allowed']
const selectedBanListsGoat = ref<string[]>(banlistOptions)
const selectedBanListsOcg = ref<string[]>(banlistOptions)
const selectedBanListsTcg = ref<string[]>(banlistOptions)

const formatOptions = [
  'Duel Links',
  'Common Charity',
  'Edison',
  'TCG',
  'OCG',
  'Master Duel',
  'GOAT',
  'OCG GOAT',
  'Speed Duel',
  'No Format',
]
const selectedFormats = ref<string[]>(formatOptions)
const selectAllFormats = () => {
  if (selectedFormats.value.length === formatOptions.length) {
    selectedFormats.value = []
  } else {
    selectedFormats.value = formatOptions
  }
}

const defaultLevelRange = [0, 13] as [number, number]
const levelMin = ref(defaultLevelRange[0])
const levelMax = ref(defaultLevelRange[1])
const resetLevel = () => {
  levelMin.value = defaultLevelRange[0]
  levelMax.value = defaultLevelRange[1]
}

const defaultAtkRange = [0, 5000] as [number, number]
const atkMin = ref(defaultAtkRange[0])
const atkMax = ref(defaultAtkRange[1])
const resetAtk = () => {
  if (filterSectionsLocked.atk) return
  atkMin.value = defaultAtkRange[0]
  atkMax.value = defaultAtkRange[1]
}

const defaultDefRange = [0, 5000] as [number, number]
const defMin = ref(defaultDefRange[0])
const defMax = ref(defaultDefRange[1])
const resetDef = () => {
  if (filterSectionsLocked.def) return
  defMin.value = defaultDefRange[0]
  defMax.value = defaultDefRange[1]
}

const defaultOcgReleaseDateRange = ['', ''] as [string, string]
const ocgReleaseDateMin = ref(defaultOcgReleaseDateRange[0])
const ocgReleaseDateMax = ref(defaultOcgReleaseDateRange[1])
const resetOcgReleaseDate = () => {
  if (filterSectionsLocked.ocgReleaseDate) return
  ocgReleaseDateMin.value = defaultOcgReleaseDateRange[0]
  ocgReleaseDateMax.value = defaultOcgReleaseDateRange[1]
}
const defaultTcgReleaseDateRange = ['', ''] as [string, string]
const tcgReleaseDateMin = ref(defaultTcgReleaseDateRange[0])
const tcgReleaseDateMax = ref(defaultTcgReleaseDateRange[1])
const resetTcgReleaseDate = () => {
  if (filterSectionsLocked.tcgReleaseDate) return
  tcgReleaseDateMin.value = defaultTcgReleaseDateRange[0]
  tcgReleaseDateMax.value = defaultTcgReleaseDateRange[1]
}
// Helper function to reset filter sections with locked items
function resetLockedFilterSection(
  sections: FilterOption[],
  allOptions: string[],
  selectedValues: Ref<string[]>,
  lockedSectionsMap: Record<string, boolean>,
) {
  // Get all types from locked sections
  const lockedTypes: string[] = []

  // Helper function to collect types from sections
  const getTypesFromSection = (section: FilterOption): string[] => {
    if (typeof section === 'string') return [section]
    return section.options.flatMap((opt) =>
      typeof opt === 'string' ? opt : getTypesFromSection(opt),
    )
  }

  // Process sections recursively to find locked sections
  const processLockedSections = (sections: FilterOption[], path: string = '0') => {
    sections.forEach((section, index) => {
      if (typeof section === 'string') return

      const currentPath = `${path}.${index}`

      // Check if this section is locked
      if (lockedSectionsMap[currentPath]) {
        // If locked, add all its types
        lockedTypes.push(...getTypesFromSection(section))
      } else if (section.options && section.options.length > 0) {
        // If not locked, recursively check its children
        processLockedSections(section.options, currentPath)
      }
    })
  }

  // Start the recursive processing
  processLockedSections(sections)

  // Reset only unlocked types
  const unlockedTypes = allOptions.filter((type) => !lockedTypes.includes(type))

  // Keep selected locked types and add all unlocked types
  selectedValues.value = [
    ...selectedValues.value.filter((type) => lockedTypes.includes(type)),
    ...unlockedTypes,
  ]
}

const resetFilters = () => {
  // Check if cardType filter is locked
  if (!filterSectionsLocked.cardType) {
    selectedCardTypes.value = cardTypeOptions
  } else {
    resetLockedFilterSection(
      cardTypeSections,
      cardTypeOptions,
      selectedCardTypes,
      filterSectionsLocked.cardType,
    )
  }

  // Handle race filter
  if (!filterSectionsLocked.race) {
    selectedRaces.value = raceOptions
  } else {
    resetLockedFilterSection(raceSections, raceOptions, selectedRaces, filterSectionsLocked.race)
  }

  // if (
  //   !filterSectionsLocked.race ||
  //   (typeof filterSectionsLocked.race === 'object' && !filterSectionsLocked.race[0])
  // )
  //   selectedRaces.value = raceOptions
  if (!filterSectionsLocked.frameType) frameTypeSelected.value = frameTypeOptions
  if (!filterSectionsLocked.attribute) selectedAttributes.value = attributeOptions
  if (!filterSectionsLocked.banlistGoat) selectedBanListsGoat.value = banlistOptions
  if (!filterSectionsLocked.banlistOcg) selectedBanListsOcg.value = banlistOptions
  if (!filterSectionsLocked.banlistTcg) selectedBanListsTcg.value = banlistOptions
  if (!filterSectionsLocked.format) selectedFormats.value = formatOptions
  resetLevel()
  resetAtk()
  resetDef()
  resetOcgReleaseDate()
  resetTcgReleaseDate()
  resetArchetypes()
}

const filterSectionsShown = reactive({
  frameType: false,
  cardType: {} as Record<string, boolean>,
  race: {} as Record<string, boolean>,
  attribute: false,
  banlistGoat: false,
  banlistOcg: false,
  banlistTcg: false,
  format: false,
  level: false,
  atk: false,
  def: false,
  ocgReleaseDate: false,
  tcgReleaseDate: false,
  archetype: false,
})
type shownKey = keyof typeof filterSectionsShown

const filterSectionsLocked = reactive({
  frameType: false,
  cardType: {} as Record<string, boolean>,
  race: {} as Record<string, boolean>,
  attribute: false,
  banlistGoat: false,
  banlistOcg: false,
  banlistTcg: false,
  format: false,
  level: false,
  atk: false,
  def: false,
  ocgReleaseDate: false,
  tcgReleaseDate: false,
  archetype: false,
})

const isNestedSection = (k: shownKey): k is 'cardType' | 'race' => k === 'cardType' || k === 'race'
const isBooleanSection = (k: shownKey): k is Exclude<shownKey, 'cardType' | 'race'> =>
  !isNestedSection(k)

const unlockAllFilters = () => {
  Object.keys(filterSectionsLocked).forEach((key) => {
    const typedKey = key as shownKey

    // Type guard to check if the key is for a nested section

    if (isNestedSection(typedKey)) {
      // For nested sections, we use an empty record
      filterSectionsLocked[typedKey] = {}
    } else {
      // For simple boolean sections
      filterSectionsLocked[typedKey] = false
    }
  })
}
const collapsePriority = computed(() => {
  return Object.values(filterSectionsShown).some((value) => {
    // If any section is shown, return true (collapse priority)
    if (value === true) return true
    // If any nested section is shown, return true (collapse priority)
    if (typeof value === 'object' && Object.values(value).some((v) => v)) return true
    return false
  })
})
const collapseNestedSection = (
  sections: FilterOption[],
  collapse: boolean,
): Record<string, boolean> => {
  const depthObject: Record<string, boolean> = {}

  // Function to process each section at different depths
  const processDepths = (options: FilterOption[], currentPath: string = '0') => {
    // Use the depth string directly as the key
    depthObject[currentPath] = !collapse // Set to false if collapsing, true if expanding

    // Process nested options
    for (let i = 0; i < options.length; i++) {
      const option = options[i]
      if (typeof option !== 'string' && option.options) {
        // Create a new path by appending the current index to the path
        const newPath = `${currentPath}.${i}`
        processDepths(option.options, newPath)
      }
    }
  }

  // Start processing from the root
  processDepths(sections)

  return depthObject
}

const collapseAllFilters = () => {
  // If collapsePriority is true, we want to collapse everything
  // If collapsePriority is false, we want to expand everything
  const shouldCollapse = collapsePriority.value

  Object.keys(filterSectionsShown).forEach((key: string) => {
    const typedKey = key as shownKey
    // Apply the function to the appropriate section
    if (isNestedSection(typedKey) && key === 'cardType') {
      filterSectionsShown[typedKey] = collapseNestedSection(cardTypeSections, shouldCollapse)
    } else if (isNestedSection(typedKey) && key === 'race') {
      filterSectionsShown[typedKey] = collapseNestedSection(raceSections, shouldCollapse)
    } else if (isBooleanSection(typedKey)) {
      // For other filter sections, just set the boolean value
      // If shouldCollapse is true, set to false (collapsed)
      // If shouldCollapse is false, set to true (expanded)
      filterSectionsShown[typedKey] = !shouldCollapse
    }
  })
}

const deckStore = useDeckStore()
const { decks, allCards, addingDeck, deletingDeck } = storeToRefs(deckStore)
const {
  getAllCards,
  getDecks,
  addDeck,
  removeDeck,
  addCardToDeck,
  removeCardFromDeck,
  changeDeckName,
} = deckStore

// Fetch all Yu-Gi-Oh! cards and decks on component mount
onMounted(async () => {
  getAllCards()
  getDecks()
})

const deckName = ref('')
const searchLimit = ref(30)

// SELECT DECK //

const selectedDeckId = ref<string | null>(null)
const selectedDeck = computed(() => decks.value.find((deck) => deck.id === selectedDeckId.value))
const setSelectedDeckId = (deckId: string) => (selectedDeckId.value = deckId)
const addDeckAndSelect = async (name: string) => {
  const deckId = await addDeck(name)
  deckName.value = ''
  setSelectedDeckId(deckId)
}

const currentDeckName = ref('')

// Update currentDeckName when selectedDeck changes
watch(selectedDeck, (newDeck) => {
  if (newDeck) {
    currentDeckName.value = newDeck.name
  }
})

// Watch for changes to currentDeckName and update the deck with debounce
watch(
  currentDeckName,
  debounce((newName: string) => {
    if (selectedDeckId.value && selectedDeck.value) {
      changeDeckName(selectedDeckId.value, newName)
    }
  }, 500),
)

const cardIdMap = computed(() =>
  allCards.value.reduce((acc, card) => {
    acc.set(card.id, card)
    return acc
  }, new Map<number, YugiohCard>()),
)

const cardsInDeck: ComputedRef<YugiohCard[] | undefined> =
  computed(
    () =>
      selectedDeck.value?.cards
        .map((cardId: number) => cardIdMap.value.get(cardId))
        .sort((a, b) => (a && b ? a.name.localeCompare(b.name) : 0))
        .filter(Boolean) as YugiohCard[] | undefined,
  ) ?? []

// Sort function for cards based on frameType and name
const sortCardsByFrameTypeAndName = (a: YugiohCard, b: YugiohCard) => {
  const frameTypes = frameTypeOptions.map((type) => type.toLowerCase())
  // Get the index of each card's frameType in frameTypeOptions
  const aIndex = frameTypes.indexOf(a.frameType.toLowerCase())
  const bIndex = frameTypes.indexOf(b.frameType.toLowerCase())

  // Sort by frameType order first
  if (aIndex !== bIndex) {
    return aIndex - bIndex
  }

  // Sort by level/rank second (if both cards have a level/rank)
  if (a.level !== undefined && b.level !== undefined) {
    return a.level - b.level
  }

  // Then sort alphabetically by name
  return a.name.localeCompare(b.name)
}

const cardsInNormalDeck = computed(() =>
  cardsInDeck.value
    ?.filter((card) => !extraDeckTypes.includes(card.type) && card.type !== 'Token')
    .sort(sortCardsByFrameTypeAndName),
)

const cardsInExtraDeck = computed(() =>
  cardsInDeck.value
    ?.filter((card) => extraDeckTypes.includes(card.type))
    .sort(sortCardsByFrameTypeAndName),
)

const tokenCards = computed(() =>
  cardsInDeck.value?.filter((card) => card.type === 'Token').sort(sortCardsByFrameTypeAndName),
)

const getCardCountInDeck = (cardId: number) => {
  return cardsInDeck.value?.filter((card) => card.id === cardId).length
}

// SELECT CARD //

const selectedCard = ref<YugiohCard | null>(null)
const selectCard = (card: YugiohCard | null) => {
  selectedCard.value = card
}

// Construct image URL from S3 bucket using card ID
const getS3ImageUrl = (cardId: number): string =>
  `${import.meta.env.VITE_S3_BUCKET_URL}${cardId}.jpg`

// CARD SEARCH //
const searchQuery = ref('')

const searchFilteredCards = computed<YugiohCard[]>(() => {
  return allCards.value
    .filter(
      (card) =>
        card.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        card.desc.toLowerCase().includes(searchQuery.value.toLowerCase()),
    )
    .filter((card) => selectedCardTypes.value.includes(card.type))
    .filter((card) =>
      frameTypeSearch.value.map((type) => type.toLowerCase()).includes(card.frameType),
    )
    .filter((card) => selectedRaces.value.includes(card.race))
    .filter((card) => selectedAttributes.value.includes(card.attribute ?? '') || !card.attribute)
    .filter(
      (card) =>
        card.misc_info[0].formats.some((format) => selectedFormats.value.includes(format)) ||
        (card.misc_info[0].formats.length === 0 && selectedFormats.value.includes('No Format')),
    )
    .filter(
      (card) =>
        selectedBanListsGoat.value.includes(card.banlist_info?.ban_goat ?? '') ||
        (selectedBanListsGoat.value.includes('Allowed') && !card.banlist_info?.ban_goat) ||
        selectedBanListsOcg.value.includes(card.banlist_info?.ban_ocg ?? '') ||
        (selectedBanListsOcg.value.includes('Allowed') && !card.banlist_info?.ban_ocg) ||
        selectedBanListsTcg.value.includes(card.banlist_info?.ban_tcg ?? '') ||
        (selectedBanListsTcg.value.includes('Allowed') && !card.banlist_info?.ban_tcg),
    )
    .filter(
      (card) =>
        card.level == null || (card.level >= levelMin.value && card.level <= levelMax.value),
    )
    .filter(
      (card) =>
        card.atk == null ||
        card.atk === -1 ||
        (card.atk >= atkMin.value && card.atk <= atkMax.value),
    )
    .filter(
      (card) =>
        card.def == null ||
        card.def === -1 ||
        (card.def >= defMin.value && card.def <= defMax.value),
    )
    .filter(
      (card) =>
        !card.misc_info[0].ocg_date ||
        ((!ocgReleaseDateMin.value || card.misc_info[0].ocg_date >= ocgReleaseDateMin.value) &&
          (!ocgReleaseDateMax.value || card.misc_info[0].ocg_date <= ocgReleaseDateMax.value)),
    )
    .filter(
      (card) =>
        !card.misc_info[0].tcg_date ||
        ((!tcgReleaseDateMin.value || card.misc_info[0].tcg_date >= tcgReleaseDateMin.value) &&
          (!tcgReleaseDateMax.value || card.misc_info[0].tcg_date <= tcgReleaseDateMax.value)),
    )
    .filter(
      (card) =>
        selectedArchetypes.value.length === 0 ||
        selectedArchetypes.value.includes(card.archetype ?? ''),
    )
    .sort((a, b) => {
      // Check if name matches search query
      const aNameMatch = a.name.toLowerCase().includes(searchQuery.value.toLowerCase())
      const bNameMatch = b.name.toLowerCase().includes(searchQuery.value.toLowerCase())

      // If one matches name and the other doesn't, prioritize the name match
      if (aNameMatch && !bNameMatch) return -1
      if (!aNameMatch && bNameMatch) return 1

      // If both match or both don't match name, maintain original order
      return 0
    })
})

// Limit suggestions to 30
const limitedSearchResults = computed(() => searchFilteredCards.value.slice(0, searchLimit.value))

const clickingOnCard = ref<number | null>(null)
const clickOnCard = (cardId: number) => {
  if (!selectedDeckId.value) return
  clickingOnCard.value = cardId
  const moveAudio = new Audio('/card_move.mp3')
  moveAudio.play()
  addCardToDeck(selectedDeckId.value, cardId)
  setTimeout(() => {
    clickingOnCard.value = null
  }, 100)
}

// Compute card archetypes and their counts
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
const filteredArchetypes = computed(() => {
  return Array.from(archetypes.value).filter(
    (archetype) =>
      archetypeSearch.value &&
      archetype.toLowerCase().includes(archetypeSearch.value.toLowerCase()),
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

const resetArchetypes = () => {
  if (!filterSectionsLocked.archetype) {
    selectedArchetypes.value = []
  }
}

watch(searchQuery, () => {
  searchLimit.value = 30
})
</script>
<template>
  <div class="p-8">
    <div class="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-end">
      <div class="flex flex-col items-start rounded-md border-1 border-gray-300 p-4">
        <h3 class="text-2xl">Decks</h3>
        <div class="mt-2 flex max-w-full flex-wrap gap-2" v-if="decks.length">
          <div
            v-for="deck in decks"
            :key="deck.id"
            class="flex max-w-full cursor-pointer items-center rounded-md border-1 border-gray-300 p-2"
          >
            <button class="max-w-full min-w-0 cursor-pointer" @click="setSelectedDeckId(deck.id)">
              <h4 class="overflow-hidden text-xl font-semibold overflow-ellipsis">
                {{ deck.name }}
              </h4>
            </button>
            <button class="ml-2 cursor-pointer" @click="removeDeck(deck.id)">
              <ArrowPathIcon v-if="deletingDeck === deck.id" class="size-6 animate-spin" />
              <TrashIcon v-else class="size-6" />
            </button>
          </div>
        </div>
        <p v-else>No decks yet</p>
      </div>
      <div class="flex basis-1/5 flex-col rounded-md border-1 border-gray-300 p-4">
        <h3 class="text-2xl">Add Deck</h3>
        <div class="flex items-center">
          <input
            type="text"
            v-model="deckName"
            placeholder="Deck name"
            class="basis-full rounded-md border-1 border-gray-300 p-2"
          />
          <button
            @click="addDeckAndSelect(deckName)"
            class="m-2 flex cursor-pointer items-center rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
            :disabled="addingDeck || !deckName"
            :class="{ 'cursor-default! opacity-50': addingDeck || !deckName }"
          >
            <ArrowPathIcon v-if="addingDeck" class="size-6 animate-spin" />
            <PlusCircleIcon v-else class="size-6" />
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="selectedDeck && selectedDeckId"
      class="mt-4 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start"
    >
      <div class="basis-4/5 rounded-md border-1 border-gray-300 p-4">
        <input v-model="currentDeckName" class="text-3xl font-semibold" />
        <DeckSection
          :cards="cardsInNormalDeck"
          :max="60"
          @select="selectCard"
          @remove="removeCardFromDeck(selectedDeckId, $event)"
        >
          Main Deck
        </DeckSection>
        <DeckSection
          :cards="cardsInExtraDeck"
          :max="15"
          @select="selectCard"
          @remove="removeCardFromDeck(selectedDeckId, $event)"
        >
          Extra Deck
        </DeckSection>
        <DeckSection
          :cards="tokenCards"
          @select="selectCard"
          @remove="removeCardFromDeck(selectedDeckId, $event)"
        >
          Tokens
        </DeckSection>
      </div>

      <div class="mb-[100vh] min-w-80 basis-1/5 text-center">
        <div class="mb-4 w-full rounded-md border-1 border-gray-300 px-2 py-4">
          <div class="mb-4 flex items-center justify-between">
            <div class="flex cursor-pointer gap-1" @click="collapseAllFilters">
              <button
                class="material-symbols-outlined cursor-pointer"
                :title="collapsePriority ? 'Collapse all' : 'Expand all'"
              >
                {{ collapsePriority ? 'collapse_all' : 'expand_all' }}
              </button>
              <h3 class="text-2xl font-semibold">Filters</h3>
            </div>
            <div class="flex gap-2">
              <button
                @click="unlockAllFilters"
                class="material-symbols-outlined cursor-pointer"
                title="Unlock all"
              >
                lock_open
              </button>
              <button
                @click="resetFilters"
                class="material-symbols-outlined cursor-pointer"
                title="Reset all"
              >
                refresh
              </button>
            </div>
          </div>
          <FilterSection
            :options="frameTypeOptions"
            v-model="frameTypeSelected"
            v-model:shown="filterSectionsShown.frameType"
            v-model:locked="filterSectionsLocked.frameType"
          >
            Frame type
          </FilterSection>
          <FilterSectionsSection
            :sections="cardTypeSections"
            :depth="'0'"
            v-model="selectedCardTypes"
            v-model:shown="filterSectionsShown.cardType"
            v-model:locked="filterSectionsLocked.cardType"
            title="Card type"
          >
            Card type
          </FilterSectionsSection>
          <FilterSectionsSection
            :sections="raceSections"
            :depth="'0'"
            v-model="selectedRaces"
            v-model:shown="filterSectionsShown.race"
            v-model:locked="filterSectionsLocked.race"
            title="Race"
          >
            Type
          </FilterSectionsSection>
          <FilterSection
            :options="attributeOptions"
            v-model="selectedAttributes"
            v-model:shown="filterSectionsShown.attribute"
            v-model:locked="filterSectionsLocked.attribute"
          >
            Attribute
          </FilterSection>
          <FilterRangeSection
            v-model:min="levelMin"
            v-model:max="levelMax"
            @reset="resetLevel"
            v-model:shown="filterSectionsShown.level"
            v-model:locked="filterSectionsLocked.level"
            :default-range="defaultLevelRange"
          >
            Level
          </FilterRangeSection>
          <FilterRangeSection
            v-model:min="atkMin"
            v-model:max="atkMax"
            @reset="resetAtk"
            v-model:shown="filterSectionsShown.atk"
            v-model:locked="filterSectionsLocked.atk"
            :default-range="defaultAtkRange"
          >
            Attack
          </FilterRangeSection>
          <FilterRangeSection
            v-model:min="defMin"
            v-model:max="defMax"
            @reset="resetDef"
            v-model:shown="filterSectionsShown.def"
            v-model:locked="filterSectionsLocked.def"
            :default-range="defaultDefRange"
          >
            Defense
          </FilterRangeSection>
          <FilterSection
            :options="formatOptions"
            v-model="selectedFormats"
            @select-all="selectAllFormats"
            v-model:shown="filterSectionsShown.format"
            v-model:locked="filterSectionsLocked.format"
          >
            Format
          </FilterSection>
          <FilterSection
            :options="banlistOptions"
            v-model="selectedBanListsGoat"
            v-model:shown="filterSectionsShown.banlistGoat"
            v-model:locked="filterSectionsLocked.banlistGoat"
          >
            GOAT Banlist
          </FilterSection>
          <FilterSection
            :options="banlistOptions"
            v-model="selectedBanListsOcg"
            v-model:shown="filterSectionsShown.banlistOcg"
            v-model:locked="filterSectionsLocked.banlistOcg"
          >
            OCG Banlist
          </FilterSection>
          <FilterSection
            :options="banlistOptions"
            v-model="selectedBanListsTcg"
            v-model:shown="filterSectionsShown.banlistTcg"
            v-model:locked="filterSectionsLocked.banlistTcg"
          >
            TCG Banlist
          </FilterSection>
          <FilterDateRangeSection
            v-model:min="ocgReleaseDateMin"
            v-model:max="ocgReleaseDateMax"
            @reset="resetOcgReleaseDate"
            v-model:shown="filterSectionsShown.ocgReleaseDate"
            v-model:locked="filterSectionsLocked.ocgReleaseDate"
            :default-range="defaultOcgReleaseDateRange"
          >
            OCG Release Date
          </FilterDateRangeSection>
          <FilterDateRangeSection
            v-model:min="tcgReleaseDateMin"
            v-model:max="tcgReleaseDateMax"
            @reset="resetTcgReleaseDate"
            v-model:shown="filterSectionsShown.tcgReleaseDate"
            v-model:locked="filterSectionsLocked.tcgReleaseDate"
            :default-range="defaultTcgReleaseDateRange"
          >
            TCG Release Date
          </FilterDateRangeSection>
          <FilterSectionWrapper
            v-model="filterSectionsShown.archetype"
            :selected="selectedArchetypes.length"
            @action="resetArchetypes"
            v-model:locked="filterSectionsLocked.archetype"
            v-model:shown="filterSectionsShown.archetype"
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

        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search for a card..."
          class="mb-4 w-full rounded-md border-1 border-gray-300 p-2"
        />

        <!-- Autocomplete Suggestions -->
        <div class="no-scrollbar sticky top-2 h-screen overflow-y-scroll">
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
            <li
              v-for="card in limitedSearchResults"
              :key="card.id"
              @dragstart.prevent=""
              @click="clickOnCard(card.id)"
              @click.right.prevent="selectCard(card)"
              class="cursor-pointer transition-transform duration-75"
              :class="{ 'scale-95': clickingOnCard === card.id }"
            >
              <div>
                <span v-if="!getCardCountInDeck(card.id)" class="text-lg text-white">&#8194;</span>
                <span v-for="i in getCardCountInDeck(card.id)" :key="i" class="text-lg text-white"
                  >•</span
                >
              </div>
              <div>
                <img :src="getS3ImageUrl(card.id)" :alt="card.name" class="w-32" />
                <p>{{ card.name }}</p>
              </div>
            </li>
          </ul>
          <button
            v-if="searchFilteredCards.length > limitedSearchResults.length"
            class="my-4 cursor-pointer rounded-md border-1 border-gray-300 p-2"
            @click="searchLimit += 30"
          >
            Load more
          </button>
        </div>
      </div>
    </div>
    <inspect-modal v-if="selectedCard" :cards="[selectedCard]" @close="selectCard(null)" />
  </div>
</template>
