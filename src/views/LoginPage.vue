<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import { useDeckStore } from '@/stores/deck'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()

const userStore = useUserStore()
const { user, loadingUser, needsUsername } = storeToRefs(userStore)

const deckStore = useDeckStore()
const { decksLoading } = storeToRefs(deckStore)
const { getDecks } = deckStore

type Mode = 'login' | 'register' | 'claim'
const mode = ref<Mode>('login')
const claimStep = ref<'username' | 'credentials'>('username')

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const username = ref('')
const errorMessage = ref('')

const oldUsername = localStorage.getItem('username')

const inputRef = ref<HTMLInputElement>()
onMounted(() => {
  inputRef.value?.focus()
})

const firebaseErrorMap: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/invalid-email': 'Invalid email address',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/wrong-password': 'Incorrect password',
  'auth/user-not-found': 'No account found with this email',
  'auth/invalid-credential': 'Incorrect email or password',
  'auth/too-many-requests': 'Too many attempts. Please try again later',
}

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code
    if (code && firebaseErrorMap[code]) return firebaseErrorMap[code]
    return err.message
  }
  return 'An unexpected error occurred'
}

const navigateAfterAuth = async () => {
  await getDecks()
  if (route.params.gameCode) {
    router.push({ name: 'play', params: { gameCode: route.params.gameCode } })
  } else {
    router.push({ path: '/deck' })
  }
}

const onLogin = async () => {
  errorMessage.value = ''
  try {
    await userStore.login(email.value, password.value)
    await navigateAfterAuth()
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

const onRegister = async () => {
  errorMessage.value = ''
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match'
    return
  }
  try {
    await userStore.register(username.value, email.value, password.value)
    await navigateAfterAuth()
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

const onFindAccount = async () => {
  errorMessage.value = ''
  try {
    const available = await userStore.checkUsername(username.value)
    if (!available) {
      errorMessage.value = 'Account not found or already claimed'
      return
    }
    claimStep.value = 'credentials'
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

const onClaimAccount = async () => {
  errorMessage.value = ''
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match'
    return
  }
  try {
    await userStore.claimAccount(username.value, email.value, password.value)
    await navigateAfterAuth()
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

const onGoogleSignIn = async () => {
  errorMessage.value = ''
  try {
    await userStore.loginWithGoogle()
    if (!needsUsername.value) {
      await navigateAfterAuth()
    }
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

const onCompleteGoogleSignUp = async () => {
  errorMessage.value = ''
  try {
    await userStore.completeGoogleSignUp(username.value)
    await navigateAfterAuth()
  } catch (err) {
    errorMessage.value = getErrorMessage(err)
  }
}

const switchMode = (newMode: Mode) => {
  mode.value = newMode
  errorMessage.value = ''
  claimStep.value = 'username'
}
</script>

<template>
  <main>
    <div class="mx-auto flex w-96 flex-col items-center gap-4 rounded-md border-1 border-gray-300 p-12">
      <!-- Migration banner for old users -->
      <div
        v-if="oldUsername && mode === 'login'"
        class="w-full rounded-md border-1 border-yellow-500 bg-yellow-500/10 p-3 text-center text-sm"
      >
        We've upgraded our login system. If you had an account as
        <strong>{{ oldUsername }}</strong
        >, use
        <button class="cursor-pointer font-semibold underline" @click="switchMode('claim'); username = oldUsername">
          Claim Account
        </button>
        to set up email and password.
      </div>

      <!-- CHOOSE USERNAME (new Google user) -->
      <template v-if="needsUsername">
        <h2 class="text-xl font-semibold">Choose a Username</h2>
        <p class="text-center text-sm text-gray-400">You're signed in with Google. Pick a username to complete your account.</p>
        <input
          ref="inputRef"
          type="text"
          v-model="username"
          placeholder="Username"
          class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
          @keyup.enter="onCompleteGoogleSignUp"
        />
        <button
          :disabled="!username"
          @click="onCompleteGoogleSignUp"
          class="w-2/3 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50"
        >
          Continue
        </button>
      </template>

      <!-- LOGIN MODE -->
      <template v-else-if="mode === 'login'">
        <h2 class="text-xl font-semibold">Sign In</h2>
        <input
          ref="inputRef"
          type="email"
          v-model="email"
          placeholder="Email"
          class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
          @keyup.enter="onLogin"
        />
        <input
          type="password"
          v-model="password"
          placeholder="Password"
          class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
          @keyup.enter="onLogin"
        />
        <button
          :disabled="!email || !password"
          @click="onLogin"
          class="w-2/3 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50"
        >
          Sign In
        </button>
        <div class="w-full flex items-center gap-3">
          <div class="h-px flex-1 bg-gray-300" />
          <span class="text-sm text-gray-400">or</span>
          <div class="h-px flex-1 bg-gray-300" />
        </div>
        <button
          @click="onGoogleSignIn"
          class="w-2/3 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600"
        >
          Sign in with Google
        </button>
        <div class="flex flex-col items-center gap-1 text-sm">
          <button class="cursor-pointer underline" @click="switchMode('register')">New user? Register</button>
          <button class="cursor-pointer underline" @click="switchMode('claim')">
            Have an existing username? Claim account
          </button>
        </div>
      </template>

      <!-- REGISTER MODE -->
      <template v-else-if="mode === 'register'">
        <h2 class="text-xl font-semibold">Register</h2>
        <input
          ref="inputRef"
          type="text"
          v-model="username"
          placeholder="Username"
          class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
        />
        <input
          type="email"
          v-model="email"
          placeholder="Email"
          class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
        />
        <input
          type="password"
          v-model="password"
          placeholder="Password"
          class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
        />
        <input
          type="password"
          v-model="confirmPassword"
          placeholder="Confirm password"
          class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
          @keyup.enter="onRegister"
        />
        <button
          :disabled="!username || !email || !password || !confirmPassword"
          @click="onRegister"
          class="w-2/3 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50"
        >
          Register
        </button>
        <button class="cursor-pointer text-sm underline" @click="switchMode('login')">
          Already have an account? Sign in
        </button>
      </template>

      <!-- CLAIM ACCOUNT MODE -->
      <template v-else-if="mode === 'claim'">
        <h2 class="text-xl font-semibold">Claim Account</h2>

        <template v-if="claimStep === 'username'">
          <p class="text-center text-sm text-gray-400">Enter your existing username to link it with a new email and password.</p>
          <input
            ref="inputRef"
            type="text"
            v-model="username"
            placeholder="Existing username"
            class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
            @keyup.enter="onFindAccount"
          />
          <button
            :disabled="!username"
            @click="onFindAccount"
            class="w-2/3 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50"
          >
            Find Account
          </button>
        </template>

        <template v-else>
          <p class="text-center text-sm text-green-400">
            Account found for <strong>{{ username }}</strong
            >. Set your email and password below.
          </p>
          <input
            type="email"
            v-model="email"
            placeholder="Email"
            class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
          />
          <input
            type="password"
            v-model="password"
            placeholder="Password"
            class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
          />
          <input
            type="password"
            v-model="confirmPassword"
            placeholder="Confirm password"
            class="w-full rounded-md border-1 border-gray-300 p-2 text-center"
            @keyup.enter="onClaimAccount"
          />
          <button
            :disabled="!email || !password || !confirmPassword"
            @click="onClaimAccount"
            class="w-2/3 cursor-pointer rounded-md border-1 border-gray-300 p-2 active:bg-gray-600 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-50"
          >
            Claim Account
          </button>
        </template>

        <button class="cursor-pointer text-sm underline" @click="switchMode('login')">Back to Sign In</button>
      </template>

      <!-- Status -->
      <div>
        <p v-if="errorMessage" class="text-red-400">{{ errorMessage }}</p>
        <div v-else-if="loadingUser || decksLoading" class="material-symbols-outlined animate-spin">refresh</div>
        <p v-else-if="user">Logged in as: {{ user.username }}</p>
      </div>
    </div>
  </main>
</template>
