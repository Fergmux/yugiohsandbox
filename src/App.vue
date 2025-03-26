<script setup lang="ts">
import router from './router/index'
import { useUserStore } from './stores/user'

const userStore = useUserStore()
</script>

<template>
  <div>
    <!-- Autocomplete Search Box -->
    <div
      class="mx-auto my-14 flex w-fit justify-between gap-4 rounded-md border-1 border-gray-300 p-4 text-2xl font-semibold"
    >
      <button class="cursor-pointer" @click="router.push('/')">Login</button>
      <button class="cursor-pointer" v-if="userStore.user" @click="router.push('/deck')">
        Decks
      </button>
      <button class="cursor-pointer" v-if="userStore.user" @click="router.push('/play')">
        Play
      </button>
      <button class="cursor-pointer" v-if="userStore.user" @click="router.push('/playground')">
        Playground
      </button>
    </div>
    <router-view />
  </div>
</template>

<style scoped></style>
