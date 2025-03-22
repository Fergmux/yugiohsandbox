<script setup lang="ts">
import InspectModal from '@/components/InspectModal.vue'
import { useDeckStore } from '@/stores/deck'
import type { YugiohCard } from '@/types'
import { ArrowPathIcon, PlusCircleIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { storeToRefs } from 'pinia'
import type { ComputedRef } from 'vue'
import { computed, onMounted, ref, watch } from 'vue'
import FilterSection from '@/components/FilterSection.vue'
import FilterRangeSection from '@/components/FilterRangeSection.vue'
import FilterDateRangeSection from '@/components/FilterDateRangeSection.vue'
import DeckSection from '@/components/DeckSection.vue'
import { reactive } from 'vue'

const extraDeckTypes = [
  'Fusion Monster',
  'Link Monster',
  'Pendulum Effect Fusion Monster',
  'Synchro Monster',
  'Synchro Pendulum Effect Monster',
  'Synchro Tuner Monster',
  'XYZ Monster',
  'XYZ Pendulum Effect Monster',
]
const mainDeckTypes = [
  'Effect Monster',
  'Flip Effect Monster',
  'Flip Tuner Effect Monster',
  'Gemini Monster',
  'Normal Monster',
  'Normal Tuner Monster',
  'Pendulum Effect Monster',
  'Pendulum Effect Ritual Monster',
  'Pendulum Flip Effect Monster',
  'Pendulum Normal Monster',
  'Pendulum Tuner Effect Monster',
  'Ritual Effect Monster',
  'Ritual Monster',
  'Spell Card',
  'Spirit Monster',
  'Toon Monster',
  'Trap Card',
  'Tuner Monster',
  'Union Effect Monster',
]
const otherDeckTypes = ['Skill Card', 'Token']
const deckTypeOptions = ['Extra Deck', 'Main Deck', 'Other']
const deckTypeSelected = ref<string[]>(deckTypeOptions)
const deckTypeSearch = computed(() =>
  deckTypeSelected.value
    .map((deckType) =>
      deckType === 'Other'
        ? otherDeckTypes
        : deckType === 'Main Deck'
          ? mainDeckTypes
          : extraDeckTypes,
    )
    .flat(),
)

const selectAllDeckTypes = () => {
  if (deckTypeSelected.value.length === deckTypeOptions.length) {
    deckTypeSelected.value = []
  } else {
    deckTypeSelected.value = deckTypeOptions
  }
}

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
const selectAllFrameTypes = () => {
  if (frameTypeSelected.value.length === frameTypeOptions.length) {
    frameTypeSelected.value = []
  } else {
    frameTypeSelected.value = frameTypeOptions
  }
}

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
]
const selectedMonsterTypes = ref<string[]>(monsterRaces)
const selectAllMonsterTypes = () => {
  if (selectedMonsterTypes.value.length === monsterRaces.length) {
    selectedMonsterTypes.value = []
  } else {
    selectedMonsterTypes.value = monsterRaces
  }
}

const spellRaces = ['Normal', 'Field', 'Equip', 'Continuous', 'Quick-Play', 'Ritual']
const selectedSpellRaces = ref<string[]>(spellRaces)
const selectAllSpellRaces = () => {
  if (selectedSpellRaces.value.length === spellRaces.length) {
    selectedSpellRaces.value = []
  } else {
    selectedSpellRaces.value = spellRaces
  }
}

const trapRaces = ['Normal', 'Continuous', 'Counter']
const selectedTrapRaces = ref<string[]>(trapRaces)
const selectAllTrapRaces = () => {
  if (selectedTrapRaces.value.length === trapRaces.length) {
    selectedTrapRaces.value = []
  } else {
    selectedTrapRaces.value = trapRaces
  }
}

const racesSearch = computed(() => [
  ...selectedMonsterTypes.value,
  ...selectedSpellRaces.value,
  ...selectedTrapRaces.value,
])

const attributeOptions = ['DARK', 'DIVINE', 'EARTH', 'FIRE', 'LIGHT', 'METAL', 'WATER', 'WIND']
const selectedAttributes = ref<string[]>(attributeOptions)
const selectAllAttributes = () => {
  if (selectedAttributes.value.length === attributeOptions.length) {
    selectedAttributes.value = []
  } else {
    selectedAttributes.value = attributeOptions
  }
}

const banlistOptions = ['Forbidden', 'Limited', 'Allowed']
const selectedBanListsGoat = ref<string[]>(banlistOptions)
const selectedBanListsOcg = ref<string[]>(banlistOptions)
const selectedBanListsTcg = ref<string[]>(banlistOptions)
const selectAllBanListsGoat = () => {
  if (selectedBanListsGoat.value.length === banlistOptions.length) {
    selectedBanListsGoat.value = []
  } else {
    selectedBanListsGoat.value = banlistOptions
  }
}
const selectAllBanListsOcg = () => {
  if (selectedBanListsOcg.value.length === banlistOptions.length) {
    selectedBanListsOcg.value = []
  } else {
    selectedBanListsOcg.value = banlistOptions
  }
}
const selectAllBanListsTcg = () => {
  if (selectedBanListsTcg.value.length === banlistOptions.length) {
    selectedBanListsTcg.value = []
  } else {
    selectedBanListsTcg.value = banlistOptions
  }
}

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
]
const selectedFormats = ref<string[]>(formatOptions)
const selectAllFormats = () => {
  if (selectedFormats.value.length === formatOptions.length) {
    selectedFormats.value = []
  } else {
    selectedFormats.value = formatOptions
  }
}

const levelMin = ref(0)
const levelMax = ref(12)
const resetLevel = () => {
  levelMin.value = 0
  levelMax.value = 12
}

const atkMin = ref(0)
const atkMax = ref(5000)
const resetAtk = () => {
  atkMin.value = 0
  atkMax.value = 5000
}

const defMin = ref(0)
const defMax = ref(5000)
const resetDef = () => {
  defMin.value = 0
  defMax.value = 5000
}

const ocgReleaseDateMin = ref('')
const ocgReleaseDateMax = ref('')
const resetOcgReleaseDate = () => {
  ocgReleaseDateMin.value = ''
  ocgReleaseDateMax.value = ''
}
const tcgReleaseDateMin = ref('')
const tcgReleaseDateMax = ref('')
const resetTcgReleaseDate = () => {
  tcgReleaseDateMin.value = ''
  tcgReleaseDateMax.value = ''
}

const resetFilters = () => {
  frameTypeSelected.value = frameTypeOptions
  deckTypeSelected.value = deckTypeOptions
  selectedMonsterTypes.value = monsterRaces
  selectedSpellRaces.value = spellRaces
  selectedTrapRaces.value = trapRaces
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
}

const filterSections = reactive({
  frameType: true,
  deckType: true,
  monsterType: true,
  spellType: true,
  trapType: true,
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
const { getAllCards, getDecks, addDeck, removeDeck, addCardToDeck, removeCardFromDeck } = deckStore

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

  // Then sort alphabetically within each frameType
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

const searchFilteredCards = computed<YugiohCard[]>(() =>
  allCards.value
    .filter(
      (card) =>
        card.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        card.desc.toLowerCase().includes(searchQuery.value.toLowerCase()),
    )
    .filter((card) =>
      frameTypeSearch.value.map((type) => type.toLowerCase()).includes(card.frameType),
    )
    .filter((card) => deckTypeSearch.value.includes(card.type))
    .filter((card) => racesSearch.value.includes(card.race))
    .filter((card) => selectedAttributes.value.includes(card.attribute ?? '') || !card.attribute)
    .filter((card) =>
      card.misc_info[0].formats.some((format) => selectedFormats.value.includes(format)),
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
    .filter((card) => !card.level || (card.level >= levelMin.value && card.level <= levelMax.value))
    .filter((card) => card.atk == null || (card.atk >= atkMin.value && card.atk <= atkMax.value))
    .filter((card) => card.def == null || (card.def >= defMin.value && card.def <= defMax.value))
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
    .slice(0, searchLimit.value),
) // Limit suggestions to 30

const clickingOnCard = ref<number | null>(null)
const clickOnCard = (cardId: number) => {
  clickingOnCard.value = cardId
  const moveAudio = new Audio('/card_move.mp3')
  moveAudio.play()
  setTimeout(() => {
    clickingOnCard.value = null
  }, 150)
}

watch(searchQuery, () => {
  searchLimit.value = 30
})
</script>

<template>
  <div class="p-8">
    <div class="flex items-end justify-between">
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

    <div v-if="selectedDeck && selectedDeckId" class="mt-4 flex items-start justify-between">
      <div class="mr-4 basis-4/5 rounded-md border-1 border-gray-300 p-4">
        <h2 class="text-3xl font-semibold">
          {{ selectedDeck.name }}
        </h2>
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
          :max="0"
          @select="selectCard"
          @remove="removeCardFromDeck(selectedDeckId, $event)"
        >
          Tokens
        </DeckSection>
      </div>

      <div class="sticky top-2 mb-[100vh] min-w-80 basis-1/5 text-center">
        <div class="mb-4 w-full rounded-md border-1 border-gray-300 p-2">
          <div class="flex justify-between">
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
            @select-all="selectAllFrameTypes"
          >
            Card type
          </FilterSection>
          <FilterSection
            :options="deckTypeOptions"
            v-model="deckTypeSelected"
            v-model:hidden="filterSections.deckType"
            @select-all="selectAllDeckTypes"
          >
            Deck
          </FilterSection>
          <FilterSection
            :options="monsterRaces"
            v-model="selectedMonsterTypes"
            v-model:hidden="filterSections.monsterType"
            @select-all="selectAllMonsterTypes"
          >
            Monster type
          </FilterSection>
          <FilterSection
            :options="spellRaces"
            v-model="selectedSpellRaces"
            v-model:hidden="filterSections.spellType"
            @select-all="selectAllSpellRaces"
          >
            Spell type
          </FilterSection>
          <FilterSection
            :options="trapRaces"
            v-model="selectedTrapRaces"
            v-model:hidden="filterSections.trapType"
            @select-all="selectAllTrapRaces"
          >
            Trap type
          </FilterSection>
          <FilterSection
            :options="attributeOptions"
            v-model="selectedAttributes"
            @select-all="selectAllAttributes"
            v-model:hidden="filterSections.attribute"
          >
            Attribute
          </FilterSection>
          <FilterRangeSection
            v-model:min="levelMin"
            v-model:max="levelMax"
            @reset="resetLevel"
            v-model:hidden="filterSections.level"
          >
            Level
          </FilterRangeSection>
          <FilterRangeSection
            v-model:min="atkMin"
            v-model:max="atkMax"
            @reset="resetAtk"
            v-model:hidden="filterSections.atk"
          >
            Attack
          </FilterRangeSection>
          <FilterRangeSection
            v-model:min="defMin"
            v-model:max="defMax"
            @reset="resetDef"
            v-model:hidden="filterSections.def"
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
            @select-all="selectAllBanListsGoat"
            v-model:hidden="filterSections.banlistGoat"
          >
            GOAT Banlist
          </FilterSection>
          <FilterSection
            :options="banlistOptions"
            v-model="selectedBanListsOcg"
            @select-all="selectAllBanListsOcg"
            v-model:hidden="filterSections.banlistOcg"
          >
            OCG Banlist
          </FilterSection>
          <FilterSection
            :options="banlistOptions"
            v-model="selectedBanListsTcg"
            @select-all="selectAllBanListsTcg"
            v-model:hidden="filterSections.banlistTcg"
          >
            TCG Banlist
          </FilterSection>
          <FilterDateRangeSection
            v-model:min="ocgReleaseDateMin"
            v-model:max="ocgReleaseDateMax"
            @reset="resetOcgReleaseDate"
            v-model:hidden="filterSections.ocgReleaseDate"
          >
            OCG Release Date
          </FilterDateRangeSection>
          <FilterDateRangeSection
            v-model:min="tcgReleaseDateMin"
            v-model:max="tcgReleaseDateMax"
            @reset="resetTcgReleaseDate"
            v-model:hidden="filterSections.tcgReleaseDate"
          >
            TCG Release Date
          </FilterDateRangeSection>
        </div>

        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search for a card..."
          class="mb-4 w-full rounded-md border-1 border-gray-300 p-2"
        />

        <!-- Autocomplete Suggestions -->
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
          <li
            v-for="card in searchFilteredCards"
            :key="card.id"
            @dragstart.prevent=""
            @click="addCardToDeck(selectedDeckId, card.id)"
            @mousedown="clickOnCard(card.id)"
            @mouseup="clickingOnCard = null"
            @click.right.prevent="selectCard(card)"
            class="cursor-pointer transition-transform duration-75"
            :class="{ 'scale-95': clickingOnCard === card.id }"
          >
            <img :src="getS3ImageUrl(card.id)" :alt="card.name" class="w-32" />
            <p>{{ card.name }}</p>
          </li>
        </ul>
        <button
          v-if="searchFilteredCards.length > 0 && searchFilteredCards.length % 30 === 0"
          class="mt-4 cursor-pointer rounded-md border-1 border-gray-300 p-2"
          @click="searchLimit += 30"
        >
          Load more
        </button>
      </div>
    </div>
    <inspect-modal v-if="selectedCard" :cards="[selectedCard]" @close="selectCard(null)" />
  </div>
</template>
