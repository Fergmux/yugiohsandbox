import type { User } from '@/types'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const user: Ref<User | undefined> = ref()
  const savedUsername = useStorage('username', '')

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
      console.log(err)
      throw err
    }
  }

  const getUser = async (username: string) => {
    try {
      const response = await fetch(`/.netlify/functions/get-user/${username}`)
      const userData: User | { message: string } = await response.json()
      if (response.status !== 200) throw new Error((userData as { message: string }).message)
      user.value = userData as User
      savedUsername.value = username
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  return { user, addUser, getUser, loginExisting }
})
