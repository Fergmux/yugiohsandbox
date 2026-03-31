<script setup lang="ts">
import { computed } from 'vue'

import { useRoute } from 'vue-router'

import router from './router/index'
import { useUserStore } from './stores/user'

const ADMIN_ID = 'k42xZxnDK6KhbBYuEiI1'

const userStore = useUserStore()
const route = useRoute()

const hasReceivedInvite = computed(() => {
  const u = userStore.user
  if (!u) return false
  return (u.invites || []).some((inv) => inv.userIdTo === u.id)
})
</script>

<template>
  <div>
    <!-- Autocomplete Search Box -->
    <div class="mx-auto my-14 flex w-fit justify-between gap-4 rounded-md border-1 border-gray-300 p-4 text-2xl">
      <button v-if="!userStore.user" class="cursor-pointer p-1" @click="router.push('/')">Login</button>
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
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.matched.some((r) => r.name === 'crawler') }"
        class="cursor-pointer p-1"
        v-if="userStore.user"
        @click="router.push('/crawler')"
      >
        Crawler
      </button>
      <button
        :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.matched.some((r) => r.name === 'crawlv2') }"
        class="cursor-pointer p-1"
        v-if="userStore.user"
        @click="router.push('/crawlv2')"
      >
        CrawlV2
      </button>
      <span v-if="userStore.user" class="relative inline-block">
        <button
          :class="{ 'bg-neutral-400 font-semibold text-gray-900': route.name === 'user' }"
          class="cursor-pointer p-1"
          :aria-label="hasReceivedInvite ? 'User (pending invites)' : 'User'"
          @click="router.push('/user')"
        >
          User
        </button>
        <span
          v-if="hasReceivedInvite"
          class="pointer-events-none absolute top-2 right-0 size-2 translate-x-0.5 -translate-y-0.5 rounded-full bg-red-500"
          aria-hidden="true"
        />
      </span>
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
