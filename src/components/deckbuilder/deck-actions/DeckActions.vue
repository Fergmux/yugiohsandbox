<script setup lang="ts">
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'

import { useDeckStore } from '@/stores/deck'

import ActionItem from './ActionItem.vue'

// Action types
type ActionType = 'share' | 'add' | 'copy' | 'rename' | 'delete'

type ActionConfig = {
  title: string
  icon: string
  placeholder?: string
}

const configs: Record<ActionType, ActionConfig> = {
  add: {
    title: 'Add Deck',
    icon: 'add',
    placeholder: 'Deck name',
  },
  rename: {
    title: 'Rename Deck',
    icon: 'edit_note',
    placeholder: 'New deck name',
  },
  copy: {
    title: 'Copy Deck',
    icon: 'content_copy',
    placeholder: 'New deck name',
  },
  share: {
    title: 'Share Deck',
    icon: 'share',
    placeholder: 'Username',
  },
  delete: {
    title: 'Delete Deck',
    icon: 'delete',
  },
}

const deckStore = useDeckStore()
const { addDeck, shareDeck, copyDeck, removeDeck, changeDeckName } = deckStore
const { selectedDeckId } = storeToRefs(deckStore)

// Action state - defaults to 'add' when no deck is selected
const explicitAction = ref<ActionType | null>(null)
const currentAction = computed<ActionType>(() =>
  !selectedDeckId.value || !explicitAction.value ? 'add' : explicitAction.value,
)

const isProcessing = ref(false)

const setAction = (action: ActionType) => {
  explicitAction.value = action
}

const resetAction = () => {
  explicitAction.value = null
}

// Action configurations
const getActionConfig = (action: ActionType) => {
  return configs[action]
}

// Handle the action when the ActionItem emits it
const handleAction = async (value: ActionType) => {
  if (!value) return

  isProcessing.value = true
  try {
    if (currentAction.value === 'share') {
      await shareDeck(value)
    } else if (currentAction.value === 'add') {
      await addDeck(value)
      // Only reset action if a deck is selected
      if (!selectedDeckId.value) {
        return
      }
    } else if (currentAction.value === 'copy') {
      await copyDeck(value)
    } else if (currentAction.value === 'rename') {
      await changeDeckName(value)
    } else if (currentAction.value === 'delete') {
      await removeDeck()
    }

    // Return to action selection screen
    resetAction()
  } catch (error) {
    console.error(`Error during ${currentAction.value} action:`, error)
  } finally {
    isProcessing.value = false
  }
}

// Determine if we should show the close button - only when a deck is selected
const showCloseButton = computed(() => !!selectedDeckId.value)

// Determine if we should show the action selector buttons
const showActionButtons = computed(() => selectedDeckId.value && explicitAction.value === null)
</script>

<template>
  <div class="rounded-md border-1 border-gray-300 p-4">
    <!-- Show action buttons when a deck is selected and no explicit action is chosen -->
    <div v-if="showActionButtons" class="flex flex-col items-center">
      <h3 class="mb-4 text-2xl font-semibold">Deck Actions</h3>
      <div class="flex gap-4">
        <button
          v-for="action in Object.keys(configs) as ActionType[]"
          :key="action"
          @click="setAction(action)"
          class="flex cursor-pointer flex-col items-center rounded-md border-1 border-gray-300 p-2"
        >
          <span class="material-symbols-outlined text-3xl">
            {{ getActionConfig(action).icon }}
          </span>
        </button>
      </div>
    </div>

    <!-- Always show the action form - which action is determined by the computed property -->
    <action-item
      v-if="!showActionButtons"
      :title="getActionConfig(currentAction).title"
      :icon="getActionConfig(currentAction).icon"
      :placeholder="getActionConfig(currentAction).placeholder"
      :is-processing="isProcessing"
      :show-close="showCloseButton"
      @close="resetAction"
      @action="handleAction"
    >
      <!-- Confirmation buttons for delete action -->
      <div v-if="currentAction === 'delete'" class="mt-4 flex justify-center gap-4">
        <button
          @click="handleAction('delete')"
          class="cursor-pointer rounded-md border-1 border-gray-300 px-4 py-2"
          :disabled="isProcessing"
        >
          <span v-if="isProcessing" class="material-symbols-outlined animate-spin leading-4">refresh</span>
          <span v-else>Yes</span>
        </button>
        <button
          @click="resetAction"
          class="cursor-pointer rounded-md border-1 border-gray-300 px-4 py-2"
          :disabled="isProcessing"
        >
          No
        </button>
      </div>
    </action-item>
  </div>
</template>
