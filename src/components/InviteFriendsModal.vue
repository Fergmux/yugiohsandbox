<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { storeToRefs } from 'pinia'

import { useUserStore } from '@/stores/user'
import type { Invite } from '@/types/user'

const props = defineProps<{
  type: Invite['type']
  gameCode: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const userStore = useUserStore()
const { user } = storeToRefs(userStore)
const { sendInvite } = userStore

const sendingTo = ref<Set<string>>(new Set())
const sentTo = ref<Set<string>>(new Set())
const error = ref('')

const friends = computed(() => user.value?.friends || [])

const alreadyInvited = computed(() => {
  const invites = user.value?.invites || []
  return new Set(
    invites
      .filter((inv) => inv.gameCode === props.gameCode && inv.type === props.type)
      .map((inv) => (inv.userIdFrom === user.value?.id ? inv.userIdTo : inv.userIdFrom)),
  )
})

const onInvite = async (friendUsername: string, friendId: string) => {
  sendingTo.value = new Set([...sendingTo.value, friendId])
  error.value = ''
  try {
    await sendInvite(friendUsername, props.type, props.gameCode)
    sentTo.value = new Set([...sentTo.value, friendId])
  } catch (err) {
    if (err instanceof Error) error.value = err.message
  } finally {
    const next = new Set(sendingTo.value)
    next.delete(friendId)
    sendingTo.value = next
  }
}

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keyup', handleKeyUp, true))
onBeforeUnmount(() => window.removeEventListener('keyup', handleKeyUp, true))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9999] flex items-center justify-center" @click="emit('close')">
      <div
        class="w-80 rounded-md border-1 border-gray-300 bg-neutral-900 p-6"
        @click.stop
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold">Invite Friends</h2>
          <button class="cursor-pointer rounded-md border-1 border-gray-300 px-2 py-0.5" @click="emit('close')">
            Close
          </button>
        </div>

        <div v-if="friends.length" class="flex flex-col gap-2">
          <div
            v-for="friend in friends"
            :key="friend.id"
            class="flex items-center justify-between rounded-md border-1 border-gray-300 px-3 py-2"
          >
            <span>{{ friend.username }}</span>
            <span v-if="alreadyInvited.has(friend.id) || sentTo.has(friend.id)" class="text-sm opacity-50">
              Invited
            </span>
            <button
              v-else
              :disabled="sendingTo.has(friend.id)"
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              @click="onInvite(friend.username, friend.id)"
            >
              Invite
            </button>
          </div>
        </div>
        <p v-else class="opacity-50">No friends added yet</p>

        <p v-if="error" class="mt-2 text-red-400">{{ error }}</p>
      </div>
    </div>
  </Teleport>
</template>
