import type { Ref } from 'vue'
import { ref } from 'vue'

import { defineStore } from 'pinia'

import type { User } from '@/types/user'
import { useStorage } from '@vueuse/core'

export const useUserStore = defineStore('user', () => {
  const user: Ref<User | undefined> = ref()
  const savedUsername = useStorage('username', '')
  const loadingUser = ref(false)

  const loginExisting = async () => {
    if (savedUsername.value) await getUser(savedUsername.value)
  }

  const addUser = async (username: string) => {
    try {
      const response = await fetch(`/.netlify/functions/add-user`, {
        method: 'POST',
        body: JSON.stringify({ username }),
      })
      const userData: User | { message: string } = await response.json()
      if (response.status !== 200) throw new Error((userData as { message: string }).message)
      user.value = userData as User
      savedUsername.value = username
    } catch (err) {
      throw err
    }
  }

  const getUser = async (username: string) => {
    if (user.value?.username === username) return
    loadingUser.value = true
    try {
      const response = await fetch(`/.netlify/functions/get-user/${username}`)
      const userData: User | { message: string } = await response.json()
      if (response.status !== 200) throw new Error((userData as { message: string }).message)
      user.value = userData as User
      savedUsername.value = username
    } catch (err) {
      console.log('user not found')
    } finally {
      loadingUser.value = false
    }
  }

  return { user, loadingUser, addUser, getUser, loginExisting }
})
