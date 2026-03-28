<script setup lang="ts">
import { ref, watch } from 'vue'

import { storeToRefs } from 'pinia'

import { useUserStore } from '@/stores/user'
import type { Friend } from '@/types/user'

const userStore = useUserStore()
const { user } = storeToRefs(userStore)
const { updateUsername, addFriend, removeFriend } = userStore

const editingUsername = ref(false)
const newUsername = ref('')
const usernameError = ref('')
const savingUsername = ref(false)

const startEditUsername = () => {
  newUsername.value = user.value?.username || ''
  usernameError.value = ''
  editingUsername.value = true
}

const cancelEditUsername = () => {
  editingUsername.value = false
  usernameError.value = ''
}

const saveUsername = async () => {
  if (!newUsername.value.trim()) return
  savingUsername.value = true
  usernameError.value = ''
  try {
    await updateUsername(newUsername.value.trim())
    editingUsername.value = false
  } catch (err) {
    if (err instanceof Error) usernameError.value = err.message
  } finally {
    savingUsername.value = false
  }
}

const friendUsername = ref('')
const friendError = ref('')
const addingFriend = ref(false)
const suggestions = ref<Friend[]>([])
const showSuggestions = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch(friendUsername, (val) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  if (!val.trim()) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  searchDebounce = setTimeout(async () => {
    const response = await fetch(
      `/.netlify/functions/search-users?term=${encodeURIComponent(val.trim())}`,
    )
    if (response.ok) {
      const results: Friend[] = await response.json()
      const currentFriendIds = new Set(user.value?.friends?.map((f) => f.id) ?? [])
      suggestions.value = results.filter(
        (u) => u.id !== user.value?.id && !currentFriendIds.has(u.id),
      )
      showSuggestions.value = suggestions.value.length > 0
    }
  }, 300)
})

const selectSuggestion = (suggestion: Friend) => {
  friendUsername.value = suggestion.username
  showSuggestions.value = false
}

const onAddFriend = async () => {
  if (!friendUsername.value.trim()) return
  addingFriend.value = true
  friendError.value = ''
  showSuggestions.value = false
  try {
    await addFriend(friendUsername.value.trim())
    friendUsername.value = ''
    suggestions.value = []
  } catch (err) {
    if (err instanceof Error) friendError.value = err.message
  } finally {
    addingFriend.value = false
  }
}

const onRemoveFriend = async (friendId: string) => {
  await removeFriend(friendId)
}

const hideSuggestions = () => {
  setTimeout(() => {
    showSuggestions.value = false
  }, 150)
}
</script>

<template>
  <main>
    <div class="mx-auto flex w-96 flex-col gap-8 rounded-md border-1 border-gray-300 p-8">
      <div>
        <h2 class="mb-4 text-xl font-semibold">Username</h2>
        <div v-if="!editingUsername" class="flex items-center gap-3">
          <span class="text-lg">{{ user?.username }}</span>
          <button
            class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1"
            @click="startEditUsername"
          >
            Edit
          </button>
        </div>
        <div v-else class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <input
              v-model="newUsername"
              type="text"
              class="w-full rounded-md border-1 border-gray-300 p-2"
              @keyup.enter="saveUsername"
            />
            <button
              :disabled="savingUsername || !newUsername.trim()"
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              @click="saveUsername"
            >
              Save
            </button>
            <button
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1"
              @click="cancelEditUsername"
            >
              Cancel
            </button>
          </div>
          <p v-if="usernameError" class="text-red-400">{{ usernameError }}</p>
        </div>
      </div>

      <div>
        <h2 class="mb-4 text-xl font-semibold">Friends</h2>
        <div v-if="user?.friends?.length" class="mb-4 flex flex-col gap-2">
          <div
            v-for="friend in user.friends"
            :key="friend.id"
            class="flex items-center justify-between rounded-md border-1 border-gray-300 px-3 py-2"
          >
            <span>{{ friend.username }}</span>
            <button
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1"
              @click="onRemoveFriend(friend.id)"
            >
              Remove
            </button>
          </div>
        </div>
        <p v-else class="mb-4 opacity-50">No friends added yet</p>

        <div class="relative flex items-center gap-2">
          <div class="relative w-full">
            <input
              v-model="friendUsername"
              type="text"
              placeholder="Username"
              class="w-full rounded-md border-1 border-gray-300 p-2"
              autocomplete="off"
              @keyup.enter="onAddFriend"
              @blur="hideSuggestions"
              @focus="showSuggestions = suggestions.length > 0"
            />
            <ul
              v-if="showSuggestions"
              class="absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-md border-1 border-gray-300 bg-white shadow-md"
            >
              <li
                v-for="suggestion in suggestions"
                :key="suggestion.id"
                class="cursor-pointer px-3 py-2 hover:bg-gray-100"
                @mousedown.prevent="selectSuggestion(suggestion)"
              >
                {{ suggestion.username }}
              </li>
            </ul>
          </div>
          <button
            :disabled="addingFriend || !friendUsername.trim()"
            class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            @click="onAddFriend"
          >
            Add
          </button>
        </div>
        <p v-if="friendError" class="mt-2 text-red-400">{{ friendError }}</p>
      </div>
    </div>
  </main>
</template>
