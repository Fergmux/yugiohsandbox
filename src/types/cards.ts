import cardImg from '@/assets/images/cards/card.png'
import effectImg from '@/assets/images/cards/effect.png'
import { type Location } from './crawlv2'
import type { Comparitors } from '@/composables/crawlv2/EffectResolver'
import type { Event } from '@/composables/crawlv2/EventBus'

type NestedKeyOf<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, number>
    ? `${Prefix}${K}`
    : T[K] extends object
      ? `${Prefix}${K}` | NestedKeyOf<T[K], `${Prefix}${K}.`>
      : `${Prefix}${K}`
}[keyof T & string]

export type Condition = {
  test?: 'has_card'
  checks?: Check[]
}
export type Check = {
  combinator?: 'and' | 'or'
  comparitor: Comparitors
  key?: NestedKeyOf<GameCard>
  value?: string
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

export type EffectDef = {
  trigger?: Event
  effect: string
  ongoing?: boolean
  /** Stays registered after firing — re-fires on subsequent triggers */
  persistent?: boolean
  /** Only fires when it is the owning card's player's turn */
  activateOnOwnerTurn?: boolean
  options?: Record<string, string | number>
  conditions?: Condition[]
  target?: Check[]
  optional?: boolean
  eventName?: Event
}

export type GameCard = Card & {
  gameId: string
  location: Location
  owner?: 'player1' | 'player2'
  buffs: Record<string, string | number>
  debuffs: Record<string, string | number>
  faceUp?: boolean
  defensePosition?: boolean
  effects?: EffectDef[]
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
