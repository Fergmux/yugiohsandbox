<script setup lang="ts">
import InspectModal from '@/components/InspectModal.vue'
import { useDeckStore } from '@/stores/deck'
import type { YugiohCard } from '@/types'
import {
  extraDeckTypes,
  mainDeckTypes,
  otherDeckTypes,
  fusionTypes,
  linkTypes,
  pendulumTypes,
  synchroTypes,
  xyzTypes,
  normalTypes,
  effectTypes,
  ritualTypes,
  tunerTypes,
  extraTunerTypes,
  type FilterOption,
} from '@/types'
import { ArrowPathIcon, PlusCircleIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { storeToRefs } from 'pinia'
import type { ComputedRef } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'
import FilterSection from '@/components/FilterSection.vue'
import FilterSectionsSection from '@/components/FilterSectionsSection.vue'
import FilterRangeSection from '@/components/FilterRangeSection.vue'
import FilterDateRangeSection from '@/components/FilterDateRangeSection.vue'
import FilterSectionWrapper from '@/components/FilterSectionWrapper.vue'
import DeckSection from '@/components/DeckSection.vue'
import { reactive } from 'vue'
import { debounce } from 'lodash'

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
      { title: 'Tuner Monsters', options: extraTunerTypes },
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
  atkMin.value = defaultAtkRange[0]
  atkMax.value = defaultAtkRange[1]
}

const defaultDefRange = [0, 5000] as [number, number]
const defMin = ref(defaultDefRange[0])
const defMax = ref(defaultDefRange[1])
const resetDef = () => {
  defMin.value = defaultDefRange[0]
  defMax.value = defaultDefRange[1]
}

const defaultOcgReleaseDateRange = ['', ''] as [string, string]
const ocgReleaseDateMin = ref(defaultOcgReleaseDateRange[0])
const ocgReleaseDateMax = ref(defaultOcgReleaseDateRange[1])
const resetOcgReleaseDate = () => {
  ocgReleaseDateMin.value = defaultOcgReleaseDateRange[0]
  ocgReleaseDateMax.value = defaultOcgReleaseDateRange[1]
}
const defaultTcgReleaseDateRange = ['', ''] as [string, string]
const tcgReleaseDateMin = ref(defaultTcgReleaseDateRange[0])
const tcgReleaseDateMax = ref(defaultTcgReleaseDateRange[1])
const resetTcgReleaseDate = () => {
  tcgReleaseDateMin.value = defaultTcgReleaseDateRange[0]
  tcgReleaseDateMax.value = defaultTcgReleaseDateRange[1]
}

const resetFilters = () => {
  frameTypeSelected.value = frameTypeOptions
  selectedCardTypes.value = cardTypeOptions
  selectedRaces.value = raceOptions
  selectedAttributes.value = attributeOptions
  selectedBanListsGoat.value = banlistOptions
  selectedBanListsOcg.value = banlistOptions
  selectedBanListsTcg.value = banlistOptions
  selectedFormats.value = formatOptions
  resetLevel()
  resetAtk()
  resetDef()
  resetOcgReleaseDate()
  resetTcgReleaseDate()
  resetArchetypes()
}

const filterSections = reactive({
  frameType: true,
  deckType: true,
  cardType: true,
  race: true,
  attribute: true,
  banlistGoat: true,
  banlistOcg: true,
  banlistTcg: true,
  format: true,
  level: true,
  atk: true,
  def: true,
  ocgReleaseDate: true,
  tcgReleaseDate: true,
  archetype: true,
})

const collapsePriority = computed(() => {
  return Object.values(filterSections).some((value) => value === true)
})

const collapseAllFilters = () => {
  const collapse = !collapsePriority.value
  Object.keys(filterSections).forEach((key) => {
    filterSections[key as keyof typeof filterSections] = collapse
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
  selectedArchetypes.value = []
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
          <div class="mb-4 flex items-end justify-between">
            <button @click="collapseAllFilters" class="cursor-pointer">
              {{ collapsePriority ? 'Expand all' : 'Collapse all' }}
            </button>
            <h3 class="text-2xl font-semibold">Filters</h3>
            <button @click="resetFilters" class="cursor-pointer">Reset filters</button>
          </div>
          <FilterSection
            :options="frameTypeOptions"
            v-model="frameTypeSelected"
            v-model:hidden="filterSections.frameType"
          >
            Frame type
          </FilterSection>
          <!-- <FilterSection
            :options="cardTypeOptions"
            v-model="selectedCardTypes"
            v-model:hidden="filterSections.cardType"
            @select-all="selectAllCardTypes"
          >
            Card type
          </FilterSection> -->
          <FilterSectionsSection
            :sections="cardTypeSections"
            :depth="0"
            v-model="selectedCardTypes"
            v-model:hidden="filterSections.deckType"
          >
            Card type
          </FilterSectionsSection>
          <FilterSectionsSection
            :sections="raceSections"
            :depth="0"
            v-model="selectedRaces"
            v-model:hidden="filterSections.race"
          >
            Type
          </FilterSectionsSection>
          <FilterSection
            :options="attributeOptions"
            v-model="selectedAttributes"
            v-model:hidden="filterSections.attribute"
          >
            Attribute
          </FilterSection>
          <FilterRangeSection
            v-model:min="levelMin"
            v-model:max="levelMax"
            @reset="resetLevel"
            v-model:hidden="filterSections.level"
            :default-range="defaultLevelRange"
          >
            Level
          </FilterRangeSection>
          <FilterRangeSection
            v-model:min="atkMin"
            v-model:max="atkMax"
            @reset="resetAtk"
            v-model:hidden="filterSections.atk"
            :default-range="defaultAtkRange"
          >
            Attack
          </FilterRangeSection>
          <FilterRangeSection
            v-model:min="defMin"
            v-model:max="defMax"
            @reset="resetDef"
            v-model:hidden="filterSections.def"
            :default-range="defaultDefRange"
          >
            Defense
          </FilterRangeSection>
          <FilterSection
            :options="formatOptions"
            v-model="selectedFormats"
            @select-all="selectAllFormats"
            v-model:hidden="filterSections.format"
          >
            Format
          </FilterSection>
          <FilterSection
            :options="banlistOptions"
            v-model="selectedBanListsGoat"
            v-model:hidden="filterSections.banlistGoat"
          >
            GOAT Banlist
          </FilterSection>
          <FilterSection
            :options="banlistOptions"
            v-model="selectedBanListsOcg"
            v-model:hidden="filterSections.banlistOcg"
          >
            OCG Banlist
          </FilterSection>
          <FilterSection
            :options="banlistOptions"
            v-model="selectedBanListsTcg"
            v-model:hidden="filterSections.banlistTcg"
          >
            TCG Banlist
          </FilterSection>
          <FilterDateRangeSection
            v-model:min="ocgReleaseDateMin"
            v-model:max="ocgReleaseDateMax"
            @reset="resetOcgReleaseDate"
            v-model:hidden="filterSections.ocgReleaseDate"
            :default-range="defaultOcgReleaseDateRange"
          >
            OCG Release Date
          </FilterDateRangeSection>
          <FilterDateRangeSection
            v-model:min="tcgReleaseDateMin"
            v-model:max="tcgReleaseDateMax"
            @reset="resetTcgReleaseDate"
            v-model:hidden="filterSections.tcgReleaseDate"
            :default-range="defaultTcgReleaseDateRange"
          >
            TCG Release Date
          </FilterDateRangeSection>
          <FilterSectionWrapper
            v-model="filterSections.archetype"
            :selected="selectedArchetypes.length"
            @action="resetArchetypes"
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
