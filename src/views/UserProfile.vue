<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { auth } from '@/firebase/client'
import { authFetch } from '@/lib/authFetch'
import { useUserStore } from '@/stores/user'
import type { Friend, Invite } from '@/types/user'

const router = useRouter()
const userStore = useUserStore()
const { user } = storeToRefs(userStore)
const { updateUsername, sendInvite, acceptInvite, declineInvite, removeFriend } = userStore

const receivedInvites = computed(() => (user.value?.invites || []).filter((inv) => inv.userIdTo === user.value?.id))

const sentInvites = computed(() => (user.value?.invites || []).filter((inv) => inv.userIdFrom === user.value?.id))

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
const sendingInvite = ref(false)
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
    const response = await authFetch(`/.netlify/functions/search-users?term=${encodeURIComponent(val.trim())}`)
    if (response.ok) {
      const results: Friend[] = await response.json()
      const currentFriendIds = new Set(user.value?.friends?.map((f) => f.id) ?? [])
      const pendingInviteIds = new Set(sentInvites.value.filter((i) => i.type === 'friend').map((i) => i.userIdTo))
      suggestions.value = results.filter(
        (u) => u.id !== user.value?.id && !currentFriendIds.has(u.id) && !pendingInviteIds.has(u.id),
      )
      const exactMatch =
        suggestions.value.length === 1 && suggestions.value[0].username.toLowerCase() === val.trim().toLowerCase()
      showSuggestions.value = suggestions.value.length > 0 && !exactMatch
    }
  }, 300)
})

const selectSuggestion = (suggestion: Friend) => {
  friendUsername.value = suggestion.username
  showSuggestions.value = false
}

const onSendFriendInvite = async () => {
  if (!friendUsername.value.trim()) return
  sendingInvite.value = true
  friendError.value = ''
  showSuggestions.value = false
  try {
    await sendInvite(friendUsername.value.trim(), 'friend')
    friendUsername.value = ''
    suggestions.value = []
  } catch (err) {
    if (err instanceof Error) friendError.value = err.message
  } finally {
    sendingInvite.value = false
  }
}

const onAcceptInvite = async (invite: Invite) => {
  await acceptInvite(invite)
  if (invite.type === 'game' && invite.gameCode) {
    router.push({ name: 'play', params: { gameCode: invite.gameCode } })
  } else if (invite.type === 'crawl' && invite.gameCode) {
    router.push({ name: 'newGame', params: { gameCode: invite.gameCode } })
  }
}

const onRemoveFriend = async (friendId: string) => {
  await removeFriend(friendId)
}

const formatTime = (iso: string) => {
  const date = new Date(iso)
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const inviteLabel = (invite: Invite) => {
  const labels: Record<Invite['type'], string> = {
    game: 'Game invite',
    crawl: 'Crawl invite',
    friend: 'Friend request',
  }
  return labels[invite.type]
}

const hideSuggestions = () => {
  setTimeout(() => {
    showSuggestions.value = false
  }, 150)
}

const hasPasswordProvider = computed(() =>
  auth.currentUser?.providerData.some((p) => p.providerId === 'password'),
)

const changingPassword = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref('')
const passwordSuccess = ref(false)
const savingPassword = ref(false)

const startChangePassword = () => {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = false
  changingPassword.value = true
}

const cancelChangePassword = () => {
  changingPassword.value = false
  passwordError.value = ''
  passwordSuccess.value = false
}

const savePassword = async () => {
  passwordError.value = ''
  passwordSuccess.value = false

  if (newPassword.value.length < 6) {
    passwordError.value = 'New password must be at least 6 characters'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match'
    return
  }

  const firebaseUser = auth.currentUser
  if (!firebaseUser || !firebaseUser.email) return

  savingPassword.value = true
  try {
    const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword.value)
    await reauthenticateWithCredential(firebaseUser, credential)
    await updatePassword(firebaseUser, newPassword.value)
    passwordSuccess.value = true
    changingPassword.value = false
  } catch (err: any) {
    const code = err?.code
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      passwordError.value = 'Current password is incorrect'
    } else if (code === 'auth/too-many-requests') {
      passwordError.value = 'Too many attempts. Please try again later'
    } else {
      passwordError.value = 'Failed to change password'
    }
  } finally {
    savingPassword.value = false
  }
}

const onLogout = async () => {
  await userStore.logout()
  router.push('/')
}
</script>

<template>
  <main>
    <div class="mx-auto flex max-w-lg flex-col gap-8 rounded-md border-1 border-gray-300 p-8">
      <div>
        <h2 class="mb-4 text-xl font-semibold">Username</h2>
        <div v-if="!editingUsername" class="flex items-center gap-3">
          <span class="text-lg">{{ user?.username }}</span>
          <button class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1" @click="startEditUsername">
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
            <button class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1" @click="cancelEditUsername">
              Cancel
            </button>
          </div>
          <p v-if="usernameError" class="text-red-400">{{ usernameError }}</p>
        </div>
      </div>

      <div>
        <h2 class="mb-4 text-xl font-semibold">Invites</h2>
        <div v-if="receivedInvites.length" class="flex flex-col gap-2">
          <div
            v-for="invite in receivedInvites"
            :key="invite.id"
            class="flex items-center justify-between rounded-md border-1 border-gray-300 px-3 py-2"
          >
            <div class="flex flex-col">
              <span class="font-medium">{{ invite.usernameFrom }}</span>
              <span class="text-sm opacity-50">{{ inviteLabel(invite) }}</span>
              <span class="text-sm opacity-50">{{ formatTime(invite.created) }}</span>
            </div>
            <div class="flex gap-2">
              <button class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1" @click="onAcceptInvite(invite)">
                Accept
              </button>
              <button class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1" @click="declineInvite(invite)">
                Decline
              </button>
            </div>
          </div>
        </div>
        <p v-else class="opacity-50">No received invites</p>
      </div>

      <div>
        <h2 class="mb-4 text-xl font-semibold">Sent Invites</h2>
        <div v-if="sentInvites.length" class="flex flex-col gap-2">
          <div
            v-for="invite in sentInvites"
            :key="invite.id"
            class="flex items-center justify-between rounded-md border-1 border-gray-300 px-3 py-2"
          >
            <div class="flex flex-col">
              <span class="font-medium">{{ invite.usernameTo }}</span>
              <span class="text-sm opacity-50">{{ inviteLabel(invite) }} · {{ formatTime(invite.created) }}</span>
            </div>
            <span class="text-sm opacity-50">Pending</span>
          </div>
        </div>
        <p v-else class="opacity-50">No sent invites</p>
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
              @keyup.enter="onSendFriendInvite"
              @blur="hideSuggestions"
              @focus="showSuggestions = suggestions.length > 0"
            />
            <ul
              v-if="showSuggestions"
              class="absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-md border-1 border-gray-300 bg-neutral-900 shadow-md"
            >
              <li
                v-for="suggestion in suggestions"
                :key="suggestion.id"
                class="cursor-pointer px-3 py-2"
                @mousedown.prevent="selectSuggestion(suggestion)"
              >
                {{ suggestion.username }}
              </li>
            </ul>
          </div>
          <button
            :disabled="sendingInvite || !friendUsername.trim()"
            class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
            @click="onSendFriendInvite"
          >
            Invite
          </button>
        </div>
        <p v-if="friendError" class="mt-2 text-red-400">{{ friendError }}</p>
      </div>

      <div v-if="hasPasswordProvider">
        <h2 class="mb-4 text-xl font-semibold">Password</h2>
        <div v-if="!changingPassword">
          <button class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1" @click="startChangePassword">
            Change Password
          </button>
          <p v-if="passwordSuccess" class="mt-2 text-green-400">Password changed successfully</p>
        </div>
        <div v-else class="flex flex-col gap-3">
          <input
            v-model="currentPassword"
            type="password"
            placeholder="Current password"
            class="w-full rounded-md border-1 border-gray-300 p-2"
          />
          <input
            v-model="newPassword"
            type="password"
            placeholder="New password"
            class="w-full rounded-md border-1 border-gray-300 p-2"
          />
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            class="w-full rounded-md border-1 border-gray-300 p-2"
            @keyup.enter="savePassword"
          />
          <p v-if="passwordError" class="text-red-400">{{ passwordError }}</p>
          <div class="flex gap-2">
            <button
              :disabled="savingPassword || !currentPassword || !newPassword || !confirmPassword"
              class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              @click="savePassword"
            >
              Save
            </button>
            <button class="cursor-pointer rounded-md border-1 border-gray-300 px-3 py-1" @click="cancelChangePassword">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div class="border-t border-gray-300 pt-6">
        <button
          class="cursor-pointer rounded-md border-1 border-red-400 px-4 py-2 text-red-400 active:bg-red-400/20"
          @click="onLogout"
        >
          Logout
        </button>
      </div>
    </div>
  </main>
</template>
