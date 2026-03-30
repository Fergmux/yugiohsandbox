import type { Ref } from 'vue'
import { ref } from 'vue'

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { defineStore } from 'pinia'

import { auth, db } from '@/firebase/client'
import { authFetch } from '@/lib/authFetch'
import type { Invite, User } from '@/types/user'

export const useUserStore = defineStore('user', () => {
  const user: Ref<User | undefined> = ref()
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

  const register = async (username: string, email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password)

    try {
      const response = await authFetch('/.netlify/functions/register-user', {
        method: 'POST',
        body: JSON.stringify({ username, email }),
      })
      const userData: User | { message: string } = await response.json()
      if (response.status !== 200) throw new Error((userData as { message: string }).message)
      user.value = userData as User
      subscribe(user.value.id)
    } catch (err) {
      // If Firestore doc creation fails, clean up the Firebase Auth account
      await credential.user.delete()
      throw err
    }
  }

  const login = async (email: string, password: string) => {
    loadingUser.value = true
    try {
      await signInWithEmailAndPassword(auth, email, password)

      const response = await authFetch('/.netlify/functions/get-user-by-uid')
      const userData: User | { message: string } = await response.json()
      if (response.status !== 200) throw new Error((userData as { message: string }).message)
      user.value = userData as User
      subscribe(user.value.id)
    } finally {
      loadingUser.value = false
    }
  }

  const logout = async () => {
    await signOut(auth)
    user.value = undefined
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  const claimAccount = async (username: string, email: string, password: string) => {
    // First verify the username exists and is unclaimed (unauthenticated check)
    const checkResponse = await fetch(`/.netlify/functions/get-user/${username}`)
    const checkData = await checkResponse.json()
    if (checkResponse.status !== 200) throw new Error(checkData.message)
    if (checkData.firebaseUid) throw new Error('This account has already been claimed')

    // Create Firebase Auth account
    await createUserWithEmailAndPassword(auth, email, password)

    try {
      // Link to existing Firestore doc
      const response = await authFetch('/.netlify/functions/claim-account', {
        method: 'POST',
        body: JSON.stringify({ username, email }),
      })
      const userData: User | { message: string } = await response.json()
      if (response.status !== 200) throw new Error((userData as { message: string }).message)
      user.value = userData as User
      subscribe(user.value.id)
    } catch (err) {
      // If claim fails, clean up the Firebase Auth account
      if (auth.currentUser) await auth.currentUser.delete()
      throw err
    }

    // Clean up old localStorage username
    localStorage.removeItem('username')
  }

  const needsUsername = ref(false)

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)

    // Check if this Google user already has a Firestore doc
    const response = await authFetch('/.netlify/functions/get-user-by-uid')
    if (response.status === 200) {
      const userData = await response.json()
      user.value = userData as User
      subscribe(user.value.id)
    } else {
      // New Google user — needs to pick a username
      needsUsername.value = true
    }
  }

  const completeGoogleSignUp = async (username: string) => {
    const email = auth.currentUser?.email || ''
    const response = await authFetch('/.netlify/functions/register-user', {
      method: 'POST',
      body: JSON.stringify({ username, email }),
    })
    const userData: User | { message: string } = await response.json()
    if (response.status !== 200) throw new Error((userData as { message: string }).message)
    user.value = userData as User
    needsUsername.value = false
    subscribe(user.value.id)
  }

  const initAuth = async () => {
    if (!auth.currentUser) return
    loadingUser.value = true
    try {
      const response = await authFetch('/.netlify/functions/get-user-by-uid')
      if (response.status !== 200) {
        // Firebase Auth user exists but no Firestore doc — e.g. Google user who hasn't picked a username
        needsUsername.value = true
        return
      }
      const userData = await response.json()
      user.value = userData as User
      subscribe(user.value.id)
    } catch (err) {
      console.error('Failed to restore session:', err)
    } finally {
      loadingUser.value = false
    }
  }

  const checkUsername = async (username: string): Promise<boolean> => {
    try {
      const response = await fetch(`/.netlify/functions/get-user/${username}`)
      if (response.status !== 200) return false
      const data = await response.json()
      return !data.firebaseUid
    } catch {
      return false
    }
  }

  const updateUser = async (data: Partial<User>) => {
    if (!user.value) return
    const response = await authFetch('/.netlify/functions/update-user', {
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
  }

  const sendInvite = async (recipientUsername: string, type: Invite['type'], gameCode?: string) => {
    if (!user.value) throw new Error('Not logged in')

    const response = await authFetch('/.netlify/functions/send-invite', {
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

    const response = await authFetch('/.netlify/functions/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ invite }),
    })
    const result = await response.json()
    if (response.status !== 200) throw new Error(result.message)
  }

  const declineInvite = async (invite: Invite) => {
    if (!user.value) throw new Error('Not logged in')

    const response = await authFetch('/.netlify/functions/decline-invite', {
      method: 'POST',
      body: JSON.stringify({ invite }),
    })
    const result = await response.json()
    if (response.status !== 200) throw new Error(result.message)
  }

  const removeFriend = async (friendId: string) => {
    if (!user.value) return

    const response = await authFetch('/.netlify/functions/remove-friend', {
      method: 'POST',
      body: JSON.stringify({ userId: user.value.id, friendId }),
    })
    const result = await response.json()
    if (response.status !== 200) throw new Error(result.message)
  }

  return {
    user,
    loadingUser,
    register,
    login,
    loginWithGoogle,
    completeGoogleSignUp,
    needsUsername,
    logout,
    claimAccount,
    initAuth,
    checkUsername,
    updateUsername,
    sendInvite,
    acceptInvite,
    declineInvite,
    removeFriend,
  }
})
