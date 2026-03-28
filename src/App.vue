<script setup lang="ts">
import { useRoute } from 'vue-router'

import router from './router/index'
import { useUserStore } from './stores/user'

const ADMIN_ID = 'k42xZxnDK6KhbBYuEiI1'

const userStore = useUserStore()
const route = useRoute()
</script>

<template>
  <div>
    <!-- Autocomplete Search Box -->
    <div class="mx-auto my-14 flex w-fit justify-between gap-4 rounded-md border-1 border-gray-300 p-4 text-2xl">
      <button
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.name === 'login' && userStore.user }"
        class="cursor-pointer p-1"
        @click="router.push('/')"
      >
        Login
      </button>
      <button
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.name === 'deck' }"
        class="cursor-pointer p-1"
        v-if="userStore.user"
        @click="router.push('/deck')"
      >
        Decks
      </button>
      <button
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.name === 'play' }"
        class="cursor-pointer p-1"
        v-if="userStore.user"
        @click="router.push('/play')"
      >
        Play
      </button>
      <button
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.name === 'playground' }"
        class="cursor-pointer p-1"
        v-if="userStore.user"
        @click="router.push('/playground')"
      >
        Playground
      </button>
      <button
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.matched.some(r => r.name === 'crawler') }"
        class="cursor-pointer p-1"
        v-if="userStore.user"
        @click="router.push('/crawler')"
      >
        Crawler
      </button>
      <button
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.name === 'user' }"
        class="cursor-pointer p-1"
        v-if="userStore.user"
        @click="router.push('/user')"
      >
        User
      </button>
      <button
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.name === 'admin' }"
        class="cursor-pointer p-1"
        v-if="userStore.user?.id === ADMIN_ID"
        @click="router.push('/admin')"
      >
        Admin
      </button>
    </div>
    <router-view />
  </div>
</template>

<style scoped></style>
