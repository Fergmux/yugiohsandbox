<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'

const userStore = useUserStore()
const { user } = storeToRefs(userStore)
const { addUser, getUser, loginExisting } = userStore
const userName = ref('')
const errorMessage = ref('')

onMounted(async () => {
  await loginExisting()
})

const onAddUser = async () => {
  errorMessage.value = ''
  try {
    await addUser(userName.value)
  } catch (err) {
    if (err instanceof Error) {
      console.log(err)
      errorMessage.value = err.message
    }
  }
}

const onGetUser = async () => {
  errorMessage.value = ''
  try {
    await getUser(userName.value)
  } catch (err) {
    if (err instanceof Error) {
      console.log(err)
      errorMessage.value = err.message
    }
  }
}
</script>

<template>
  <main>
    <div class="mx-auto flex w-80 flex-col items-center rounded-md border-1 border-gray-300 p-14">
      <input
        type="text"
        v-model="userName"
        placeholder="User name"
        class="m-2 w-full rounded-md border-1 border-gray-300 p-2"
      />
      <button
        :disabled="!userName"
        @click="onAddUser"
        class="m-2 w-full cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50"
      >
        Add User
      </button>
      <button
        :disabled="!userName"
        @click="onGetUser"
        class="m-2 mb-4 w-full cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50"
      >
        Get User
      </button>
      <p v-if="errorMessage">{{ errorMessage }}</p>
      <p v-else-if="user">Logged in as: {{ user.username }}</p>
      <p v-else>Not logged in</p>
    </div>
  </main>
</template>
