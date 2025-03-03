import { Client, fql as q } from 'fauna'

export const fql = q

export const client = new Client({
  secret: process.env.FAUNADB_SERVER_SECRET as string,
})
