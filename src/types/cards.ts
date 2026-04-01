import cardImg from '@/assets/images/cards/card.png'
import effectImg from '@/assets/images/cards/effect.png'
import { type Location } from './crawlv2'
import type { Comparitors } from '@/composables/crawlv2/EffectResolver'

type NestedKeyOf<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, number>
    ? `${Prefix}${K}`
    : T[K] extends object
      ? `${Prefix}${K}` | NestedKeyOf<T[K], `${Prefix}${K}.`>
      : `${Prefix}${K}`
}[keyof T & string]

export type Condition = {
  combinator?: 'and' | 'or'
  comparitor: Comparitors
  key: NestedKeyOf<GameCard>
  value: string
}

export type Card = {
  id: number
  name: string
  image: string
  atk?: number
  def?: number
  cost: number
  type?: string
  race?: string
  damage?: string
  description?: string
  effect?: string
  rarity?: string
}

export type GameCard = Card & {
  gameId: string
  location: Location
  owner?: 'player1' | 'player2'
  buffs: { [key: string]: number }
  debuffs: { [key: string]: number }
  faceUp?: boolean
  defensePosition?: boolean
  effects?: {
    trigger: string
    effect: string
    conditions?: Condition[]
    targetType?: string
    options?: Record<string, unknown>
  }[]
}

export const cards = [
  {
    id: 1,
    name: 'Warrior',
    image: cardImg,
    atk: 10,
    def: 10,
    cost: 1,
    type: 'unit',
    race: 'warrior',
    damage: 'physical',
    description: 'A strong guy',
    effect: 'He kills people',
    rarity: 'common',
  },
  {
    id: 3,
    name: 'Dragon',
    image: cardImg,
    atk: 12,
    def: 8,
    cost: 2,
    type: 'unit',
    race: 'dragon',
    damage: 'fire',
    description: 'A fire breathing dragon',
    effect: 'He kills people',
    rarity: 'rare',
  },
  {
    id: 2,
    name: 'Effect',
    image: effectImg,
    cost: 0,
    type: 'effect',
    description: 'Deal 500 damage to an enemy unit',
  },
]
