export interface User {
  id: string
  username: string
}

export interface CardImage {
  image_url: string
}

export interface YugiohCard {
  id: number
  name: string
  desc: string
  type: string
  card_images: CardImage[]
}

export interface Deck {
  id: string
  name: string
  cards: number[]
}
