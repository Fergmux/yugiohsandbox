import type { User } from '@/types'
import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const user: Ref<User | undefined> = ref()

  const addUser = async (username: string) => {
    try {
      const response = await fetch(`/.netlify/functions/add-user`, {
        method: 'POST',
        body: JSON.stringify({ username }),
      })
      const userData: User = await response.json()
      console.log(userData)
      user.value = userData

      if (!response.ok) throw new Error('User not found')
    } catch (err) {
      console.log(err)
    }
  }

  const getUser = async (username: string) => {
    try {
      const response = await fetch(`/.netlify/functions/get-user/${username}`)
      const userData: User = await response.json()
      user.value = userData
    } catch (err) {
      console.log(err)
    }
  }

  return { user, addUser, getUser }
})
