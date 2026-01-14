<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import { useDeckStore } from '@/stores/deck'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()

const userStore = useUserStore()
const { user, loadingUser } = storeToRefs(userStore)
const { addUser, getUser, loginExisting } = userStore

const deckStore = useDeckStore()
const { decksLoading } = storeToRefs(deckStore)
const { getDecks } = deckStore

const userName = ref('')
const errorMessage = ref('')

const inputRef = ref<HTMLInputElement>()
onMounted(async () => {
  await loginExisting()
  inputRef.value?.focus()
})

const onAddUser = async () => {
  errorMessage.value = ''
  try {
    await addUser(userName.value)
  } catch (err) {
    if (err instanceof Error) {
      errorMessage.value = err.message
    }
  }
}

const onGetUser = async () => {
  errorMessage.value = ''
  try {
    try {
      await getUser(userName.value)
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message)
      }
    }
    await getDecks()
    if (route.params.gameCode) {
      router.push({ name: 'play', params: { gameCode: route.params.gameCode } })
    } else {
      router.push({ path: '/deck' })
    }
  } catch (err) {
    if (err instanceof Error) {
      errorMessage.value = err.message
    }
  }
}
</script>

<template>
  <main>
    <div class="mx-auto flex w-80 flex-col items-center gap-4 rounded-md border-1 border-gray-300 p-12">
      <input
        ref="inputRef"
        type="text"
        v-model="userName"
        placeholder="User name"
        class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
        @keyup.enter="onGetUser"
      />
      <button
        :disabled="!userName"
        @click="onGetUser"
        @keyup.enter="onGetUser"
        class="w-2/3 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50"
      >
        Get User
      </button>
      <button
        :disabled="!userName"
        @click="onAddUser"
        @keyup.enter="onAddUser"
        class="w-2/3 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50"
      >
        Add User
      </button>
      <div>
        <p v-if="errorMessage">{{ errorMessage }}</p>
        <div v-else-if="loadingUser || decksLoading" class="material-symbols-outlined animate-spin">refresh</div>
        <p v-else-if="user">Logged in as: {{ user.username }}</p>
        <p v-else>Not logged in</p>
      </div>
    </div>
  </main>
</template>
