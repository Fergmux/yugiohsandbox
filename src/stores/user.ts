import type { Ref } from 'vue'
import { ref } from 'vue'

import { defineStore } from 'pinia'

import type { Friend, User } from '@/types/user'
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

  const updateUser = async (data: Partial<User>) => {
    if (!user.value) return
    const response = await fetch('/.netlify/functions/update-user', {
      method: 'POST',
      body: JSON.stringify({ id: user.value.id, ...data }),
    })
    const result = await response.json()
    if (response.status !== 200) throw new Error(result.message)
  }

  const updateUsername = async (newUsername: string) => {
    if (!user.value) return
    await updateUser({ username: newUsername })
    user.value.username = newUsername
    savedUsername.value = newUsername.toLowerCase()
  }

  const addFriend = async (friendUsername: string): Promise<Friend> => {
    if (!user.value) throw new Error('Not logged in')

    const response = await fetch(`/.netlify/functions/get-user/${friendUsername.toLowerCase()}`)
    const userData = await response.json()
    if (response.status !== 200) throw new Error('User not found')

    const friend: Friend = { id: userData.id, username: userData.username }

    if (user.value.friends?.some((f) => f.id === friend.id)) {
      throw new Error('Already friends')
    }

    const updatedFriends = [...(user.value.friends || []), friend]
    await updateUser({ friends: updatedFriends })
    user.value.friends = updatedFriends
    return friend
  }

  const removeFriend = async (friendId: string) => {
    if (!user.value) return
    const updatedFriends = (user.value.friends || []).filter((f) => f.id !== friendId)
    await updateUser({ friends: updatedFriends })
    user.value.friends = updatedFriends
  }

  return { user, loadingUser, addUser, getUser, loginExisting, updateUsername, addFriend, removeFriend }
})
