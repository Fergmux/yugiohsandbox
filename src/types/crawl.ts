export interface Power {
  name: string
  description: string
  id: string
}

export interface Crawl {
  code: number | null
  round: number
  duelId: string | null
  player1: {
    id: string | null
    deck: number[]
    powers: Power[]
  }
  player2: {
    id: string | null
    deck: number[]
    powers: Power[]
  }
}
