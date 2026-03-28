export type Invite = {
  id: string
  username: string
  created: string
}
export type Friend = {
  id: string
  username: string
}
export interface User {
  id: string
  username: string
  friends: Friend[]
  invites: Invite[]
}
