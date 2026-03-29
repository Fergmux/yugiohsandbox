import type { Ref } from 'vue'
import { ref } from 'vue'

import { doc, onSnapshot } from 'firebase/firestore'
import { defineStore } from 'pinia'

import { db } from '@/firebase/client'
import type { Invite, User } from '@/types/user'
import { useStorage } from '@vueuse/core'

export const useUserStore = defineStore('user', () => {
  const user: Ref<User | undefined> = ref()
  const savedUsername = useStorage('username', '')
  const loadingUser = ref(false)
  let unsubscribe: (() => void) | null = null

  const subscribe = (userId: string) => {
    if (unsubscribe) unsubscribe()
    unsubscribe = onSnapshot(doc(db, 'users', userId), (snapshot) => {
      if (!snapshot.exists()) return
      const data = snapshot.data()
      user.value = { id: snapshot.id, ...data } as User
    })
  }

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
      subscribe(user.value.id)
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
      subscribe(user.value.id)
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

  const sendInvite = async (recipientUsername: string, type: Invite['type'], gameCode?: string) => {
    if (!user.value) throw new Error('Not logged in')

    const response = await fetch('/.netlify/functions/send-invite', {
      method: 'POST',
      body: JSON.stringify({
        senderId: user.value.id,
        senderUsername: user.value.username,
        recipientUsername,
        type,
        gameCode,
      }),
    })
    const result = await response.json()
    if (response.status !== 200) throw new Error(result.message)

    return result as Invite
  }

  const acceptInvite = async (invite: Invite) => {
    if (!user.value) throw new Error('Not logged in')

    const response = await fetch('/.netlify/functions/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ invite }),
    })
    const result = await response.json()
    if (response.status !== 200) throw new Error(result.message)
  }

  const declineInvite = async (invite: Invite) => {
    if (!user.value) throw new Error('Not logged in')

    const response = await fetch('/.netlify/functions/decline-invite', {
      method: 'POST',
      body: JSON.stringify({ invite }),
    })
    const result = await response.json()
    if (response.status !== 200) throw new Error(result.message)
  }

  const removeFriend = async (friendId: string) => {
    if (!user.value) return

    const response = await fetch('/.netlify/functions/remove-friend', {
      method: 'POST',
      body: JSON.stringify({ userId: user.value.id, friendId }),
    })
    const result = await response.json()
    if (response.status !== 200) throw new Error(result.message)
  }

  return {
    user,
    loadingUser,
    addUser,
    getUser,
    loginExisting,
    updateUsername,
    sendInvite,
    acceptInvite,
    declineInvite,
    removeFriend,
  }
})
