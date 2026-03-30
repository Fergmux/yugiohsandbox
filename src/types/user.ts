export type Invite = {
  id: string
  usernameTo: string
  userIdTo: string
  usernameFrom: string
  userIdFrom: string
  created: string
  gameCode: string | null
  type: 'game' | 'crawl' | 'friend'
}
export type Friend = {
  id: string
  username: string
}
export interface User {
  id: string
  username: string
  firebaseUid?: string
  email?: string
  friends: Friend[]
  invites: Invite[]
}
