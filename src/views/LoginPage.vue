<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'

const userStore = useUserStore()
const { user } = storeToRefs(userStore)
const { addUser, getUser } = userStore
const userName = ref('ferg')
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
        @click="addUser(userName)"
        class="m-2 w-full cursor-pointer rounded-md border-1 border-gray-300 p-2"
      >
        Add User
      </button>
      <button
        @click="getUser(userName)"
        class="m-2 w-full cursor-pointer rounded-md border-1 border-gray-300 p-2"
      >
        Get User
      </button>
      <p v-if="user">Logged in as: {{ user.username }}</p>
      <p v-else>Not logged in</p>
    </div>
  </main>
</template>
