<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { Power } from '@/types/crawl'
import type { Deck } from '@/types/deck'

const ADMIN_ID = 'k42xZxnDK6KhbBYuEiI1'

const powers = ref<Power[]>([])
const decks = ref<Deck[]>([])
const loading = ref(false)
const loadingDecks = ref(false)
const saving = ref(false)

const editingPower = ref<Power | null>(null)
const showAddForm = ref(false)

const formName = ref('')
const formDescription = ref('')

const editName = ref('')
const editDescription = ref('')

const fetchPowers = async () => {
  loading.value = true
  try {
    const response = await fetch('/.netlify/functions/get-powers')
    powers.value = await response.json()
  } finally {
    loading.value = false
  }
}

const fetchDecks = async () => {
  loadingDecks.value = true
  try {
    const response = await fetch(`/.netlify/functions/get-decks/${ADMIN_ID}`)
    decks.value = await response.json()
  } finally {
    loadingDecks.value = false
  }
}

const starterDecks = computed(() => decks.value.filter((d) => d.type === 'starter'))
const rewardDecks = computed(() => decks.value.filter((d) => d.type === 'reward'))
const unassignedDecks = computed(() => decks.value.filter((d) => !d.type))

const toggleDeckType = async (deck: Deck, type: 'starter' | 'reward') => {
  const newType = deck.type === type ? null : type

  deck.type = newType
  await fetch('/.netlify/functions/set-deck-type', {
    method: 'POST',
    body: JSON.stringify({ deckId: deck.id, type: newType }),
  })
}

const openAddForm = () => {
  formName.value = ''
  formDescription.value = ''
  showAddForm.value = true
}

const closeAddForm = () => {
  showAddForm.value = false
  formName.value = ''
  formDescription.value = ''
}

const startEditing = (power: Power) => {
  editingPower.value = power
  editName.value = power.name
  editDescription.value = power.description
}

const cancelEditing = () => {
  editingPower.value = null
  editName.value = ''
  editDescription.value = ''
}

const saveEdit = async () => {
  if (!editingPower.value || !editName.value.trim() || !editDescription.value.trim()) return
  saving.value = true
  try {
    const response = await fetch('/.netlify/functions/update-power', {
      method: 'POST',
      body: JSON.stringify({
        id: editingPower.value.id,
        name: editName.value.trim(),
        description: editDescription.value.trim(),
      }),
    })
    const updated: Power = await response.json()
    const index = powers.value.findIndex((p) => p.id === updated.id)
    if (index !== -1) powers.value[index] = updated
    cancelEditing()
  } finally {
    saving.value = false
  }
}

const addPower = async () => {
  if (!formName.value.trim() || !formDescription.value.trim()) return
  saving.value = true
  try {
    const response = await fetch('/.netlify/functions/add-power', {
      method: 'POST',
      body: JSON.stringify({
        name: formName.value.trim(),
        description: formDescription.value.trim(),
      }),
    })
    const created: Power = await response.json()
    powers.value.push(created)
    closeAddForm()
  } finally {
    saving.value = false
  }
}

const deletePower = async (power: Power) => {
  if (!confirm(`Delete "${power.name}"?`)) return
  try {
    await fetch('/.netlify/functions/delete-power', {
      method: 'POST',
      body: JSON.stringify({ id: power.id }),
    })
    powers.value = powers.value.filter((p) => p.id !== power.id)
  } catch (err) {
    console.error(err)
  }
}

onMounted(() => {
  fetchPowers()
  fetchDecks()
})
</script>

<template>
  <div class="mx-auto max-w-3xl p-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-3xl font-semibold">Admin Panel</h1>
      <button
        class="cursor-pointer rounded-md border-1 border-gray-300 px-4 py-2 transition-colors"
        @click="openAddForm"
      >
        + Add Power
      </button>
    </div>

    <div v-if="loading" class="py-12 text-center text-lg text-gray-400">Loading powers...</div>

    <div v-else-if="powers.length === 0" class="py-12 text-center text-lg text-gray-400">
      No powers found. Add one to get started.
    </div>

    <ul v-else class="flex flex-col gap-3">
      <li v-for="power in powers" :key="power.id" class="rounded-md border-1 border-gray-300 p-4">
        <div v-if="editingPower?.id === power.id" class="flex items-start justify-between gap-4">
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <input
              v-model="editName"
              type="text"
              class="w-full rounded-md border-1 border-gray-300 bg-transparent p-2 text-xl font-medium outline-none focus:border-white"
              placeholder="Power name"
            />
            <textarea
              v-model="editDescription"
              rows="2"
              class="w-full resize-none rounded-md border-1 border-gray-300 bg-transparent p-2 text-gray-400 outline-none focus:border-white"
              placeholder="Power description"
            />
          </div>
          <div class="flex shrink-0 gap-2">
            <button
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 transition-colors"
              @click="cancelEditing"
            >
              Cancel
            </button>
            <button
              :disabled="saving || !editName.trim() || !editDescription.trim()"
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              @click="saveEdit"
            >
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
        <div v-else class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-medium">{{ power.name }}</h2>
            <p class="mt-1 text-gray-400">{{ power.description }}</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 transition-colors"
              @click="startEditing(power)"
            >
              Edit
            </button>
            <button
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 transition-colors"
              @click="deletePower(power)"
            >
              Delete
            </button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Starter Decks -->
    <div class="mt-10">
      <h2 class="mb-4 text-2xl font-semibold">Starter Decks</h2>
      <div v-if="loadingDecks" class="py-6 text-center text-gray-400">Loading decks...</div>
      <div v-else-if="starterDecks.length === 0" class="py-6 text-center text-gray-400">
        No starter decks assigned!.
      </div>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="deck in starterDecks"
          :key="deck.id"
          class="flex items-center justify-between rounded-md border-1 border-gray-300 p-3"
        >
          <span>{{ deck.name }}</span>
          <button
            class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 transition-colors"
            @click="toggleDeckType(deck, 'starter')"
          >
            Remove
          </button>
        </li>
      </ul>
    </div>

    <!-- Reward Decks -->
    <div class="mt-10">
      <h2 class="mb-4 text-2xl font-semibold">Reward Decks</h2>
      <div v-if="loadingDecks" class="py-6 text-center text-gray-400">Loading decks...</div>
      <div v-else-if="rewardDecks.length === 0" class="py-6 text-center text-gray-400">No reward decks assigned.</div>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="deck in rewardDecks"
          :key="deck.id"
          class="flex items-center justify-between rounded-md border-1 border-gray-300 p-3"
        >
          <span>{{ deck.name }}</span>
          <button
            class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 transition-colors"
            @click="toggleDeckType(deck, 'reward')"
          >
            Remove
          </button>
        </li>
      </ul>
    </div>

    <!-- Unassigned Decks -->
    <div v-if="!loadingDecks && unassignedDecks.length > 0" class="mt-10">
      <h2 class="mb-4 text-2xl font-semibold">Unassigned Decks</h2>
      <ul class="flex flex-col gap-2">
        <li
          v-for="deck in unassignedDecks"
          :key="deck.id"
          class="flex items-center justify-between rounded-md border-1 border-gray-300 p-3"
        >
          <span>{{ deck.name }}</span>
          <div class="flex gap-2">
            <button
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 transition-colors"
              @click="toggleDeckType(deck, 'starter')"
            >
              Set Starter
            </button>
            <button
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 transition-colors"
              @click="toggleDeckType(deck, 'reward')"
            >
              Set Reward
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Add Power Modal -->
    <div
      v-if="showAddForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      @click.self="closeAddForm"
    >
      <div class="w-full max-w-md rounded-md border-1 border-gray-300 bg-neutral-900 p-6">
        <h2 class="mb-4 text-2xl font-semibold">Add Power</h2>
        <form @submit.prevent="addPower" class="flex flex-col gap-4">
          <div>
            <label class="mb-1 block text-sm text-gray-400">Name</label>
            <input
              v-model="formName"
              type="text"
              class="w-full rounded-md border-1 border-gray-300 bg-transparent p-2 outline-none focus:border-white"
              placeholder="Power name"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-400">Description</label>
            <textarea
              v-model="formDescription"
              rows="3"
              class="w-full resize-none rounded-md border-1 border-gray-300 bg-transparent p-2 outline-none focus:border-white"
              placeholder="Power description"
            />
          </div>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="cursor-pointer rounded-md border-1 border-gray-300 px-4 py-2 transition-colors"
              @click="closeAddForm"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving || !formName.trim() || !formDescription.trim()"
              class="cursor-pointer rounded-md border-1 border-gray-300 px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
