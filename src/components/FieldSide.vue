<script setup lang="ts">
import CardSlot from '@/components/CardSlot.vue'
import type { BoardSide, GameState, YugiohCard } from '@/types'
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

// Handle game state synchronisation
const props = defineProps<{
  modelValue: GameState
  deck: 'cards1' | 'cards2'
  interactive?: boolean
}>()
const i = computed(() => props.interactive || undefined)

const emit = defineEmits<{
  (e: 'update:modelValue', value: GameState): void
  (e: 'update'): void
}>()

const gameState = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
  },
})

// Random constants
const topRow = Array(6)
  .fill(0)
  .map((_, i) => i)
const bottomRow = Array(5)
  .fill(0)
  .map((_, i) => i + 6)

// Utility functions
const getCards = (location: keyof BoardSide) => gameState.value[props.deck][location]

const getCard = (location: keyof BoardSide, index: number) => getCards(location)[index]

const isSelected = (location: keyof BoardSide, index: number) =>
  selectedCardLocation.value === location && selectedCardIndex.value === index

const getActions = (location: keyof BoardSide, index: number) =>
  selectedCard.value && !getCard('field', index)
    ? ['set']
    : getCard('field', index)
      ? ['flip', 'position']
      : []

const getS3ImageUrl = (cardId: number): string =>
  `${import.meta.env.VITE_S3_BUCKET_URL}${cardId}.jpg`

const updateGame = async () => {
  emit('update')
}

// Selecting card
const selectedCard: Ref<YugiohCard | undefined> = ref()
const selectedCardLocation: Ref<keyof BoardSide | undefined> = ref()
const selectedCardIndex: Ref<number | undefined> = ref()

const selectCard = (card: YugiohCard, location: keyof BoardSide, index?: number) => {
  if (selectedCardLocation.value === location && selectedCardIndex.value === index) {
    resetSelectedCard()
  } else {
    selectedCard.value = card
    selectedCardLocation.value = location
    selectedCardIndex.value = index
  }
}

const resetSelectedCard = () => {
  selectedCard.value = undefined
  selectedCardLocation.value = undefined
  selectedCardIndex.value = undefined
}

const handleFieldClick = (index: number) => {
  const card = getCard('field', index)
  if (card) {
    selectCard(card, 'field', index)
  } else {
    moveCard('field', index)
  }
}

// Moving cards
const drawCard = (source: keyof BoardSide) => {
  if (!gameState.value[props.deck][source].length) return
  const card = gameState.value[props.deck][source].pop()
  if (!card) return
  gameState.value[props.deck].hand.push({ ...card, faceDown: false })
  updateGame()
}

const moveCard = (destination: keyof BoardSide, index?: number) => {
  if (!selectedCardLocation.value || selectedCardIndex.value === undefined) return
  const card = gameState.value[props.deck][selectedCardLocation.value][selectedCardIndex.value]
  if (!card) return
  if (selectedCardLocation.value === 'field') {
    gameState.value[props.deck][selectedCardLocation.value].splice(selectedCardIndex.value, 1, null)
  } else {
    gameState.value[props.deck][selectedCardLocation.value].splice(selectedCardIndex.value, 1)
  }
  if (index != undefined) {
    // To the field
    const target = gameState.value[props.deck][destination][index]
    if (target === null) {
      gameState.value[props.deck][destination][index] = card
    } else {
      gameState.value[props.deck][destination].splice(index, 0, card)
    }
  } else {
    if (destination === 'deck') {
      gameState.value[props.deck][destination].push({
        ...card,
        faceDown: true,
        defense: false,
      })
    } else {
      gameState.value[props.deck][destination].push({
        ...card,
        faceDown: false,
        defense: false,
      })
    }
  }
  resetSelectedCard()
  updateGame()
}

const handleAction = (action: string, destination: keyof BoardSide, index: number) => {
  switch (action) {
    case 'set':
      if (!selectedCardLocation.value || selectedCardIndex.value === undefined) return
      const selectedCard = getCard(selectedCardLocation.value, selectedCardIndex.value)
      if (!selectedCard) return
      selectedCard.faceDown = true
      if (!(selectedCard.type === 'Trap Card' || selectedCard.type === 'Spell Card')) {
        selectedCard.defense = true
      }
      moveCard(destination, index)
      break
    case 'flip':
      const cardToFlip = getCard(destination, index)
      if (!cardToFlip) return
      cardToFlip.faceDown = !cardToFlip.faceDown
      updateGame()
      break
    case 'position':
      const cardToChange = getCard(destination, index)
      if (!cardToChange) return
      cardToChange.defense = !cardToChange.defense
      updateGame()
      break
  }
}
</script>
<template>
  <!-- PLAYER -->
  <div>
    <div class="grid w-full grid-cols-7 gap-2">
      <!-- TOP ROW -->
      <card-slot
        v-for="index in topRow"
        :key="index"
        :card="getCard('field', index)"
        @click.stop="i && handleFieldClick(index)"
        :selected="i && isSelected('field', index)"
        :actions="i && getActions('field', index)"
        :hint="i && getCard('field', index)?.faceDown ? getCard('field', index)?.name : undefined"
        @action="(evt) => i && handleAction(evt, 'field', index)"
      />
      <!-- GRAVEYARD -->
      <card-slot
        :card="getCard('graveyard', getCards('graveyard').length - 1)"
        :hint="getCards('graveyard').length"
        @click.stop="i && moveCard('graveyard')"
      />
      <!-- EXTRA DECK -->
      <card-slot
        :card="getCard('extra', getCards('extra').length - 1)"
        :hint="getCards('extra').length"
        @click="drawCard('extra')"
      />
      <!-- BOTTOM ROW -->
      <card-slot
        v-for="index in bottomRow"
        :key="index"
        :card="getCard('field', index)"
        @click.stop="i && handleFieldClick(index)"
        :selected="i && isSelected('field', index)"
        :actions="i && getActions('field', index)"
        :hint="i && getCard('field', index)?.faceDown ? getCard('field', index)?.name : undefined"
        @action="(evt) => i && handleAction(evt, 'field', index)"
      />
      <!-- DECK -->
      <card-slot
        :card="getCard('deck', getCards('deck').length - 1)"
        :hint="getCards('deck').length"
        @click.stop="i && drawCard('deck')"
      />
    </div>
    <div @click="i && moveCard('hand')" class="m-8 flex h-[20vh] w-full justify-center">
      <template v-for="(card, index) in getCards('hand')" :key="`${card?.id}+${index}`">
        <img
          v-if="card"
          :class="{
            'border-4 border-yellow-200': isSelected('hand', index),
          }"
          class="max-h-full"
          @click.stop="i && selectCard(card, 'hand', index)"
          :src="getS3ImageUrl(i ? card.id : 0)"
        />
      </template>
    </div>
  </div>
</template>
