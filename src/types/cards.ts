import cardImg from '@/assets/images/cards/card.png'
import effectImg from '@/assets/images/cards/effect.png'
import trapImg from '@/assets/images/cards/trap.png'
import { type Location } from './crawlv2'
import type { Comparator } from '@/composables/crawlv2/CheckSystem'
import { Event } from '@/composables/crawlv2/EventBus'

export type EffectTrigger = Event | 'manual'

type NestedKeyOf<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, number>
    ? `${Prefix}${K}`
    : T[K] extends object
      ? `${Prefix}${K}` | NestedKeyOf<T[K], `${Prefix}${K}.`>
      : `${Prefix}${K}`
}[keyof T & string]

export type Condition = {
  test?: 'has_card' | 'event_target'
  checks?: Check[]
}
export type Check = {
  combinator?: 'and' | 'or'
  comparitor: Comparator
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
  effects?: EffectDef[]
  rarity?: string
}

export type EffectDef = {
  trigger?: EffectTrigger
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
  /** Maximum number of times this effect can be activated */
  uses?: number
  /** Current number of times this effect has been activated */
  activations?: number
  /** Event that resets the activations counter */
  resetOnEvent?: Event
  /** Spent on use */
  spentOnUse?: boolean
}

export type GameCard = Card & {
  gameId: string
  location: Location
  owner?: 'player1' | 'player2'
  buffs: Record<string, string | number>
  debuffs: Record<string, string | number>
  faceUp?: boolean
  defensePosition?: boolean
}

export const cards: Card[] = [
  {
    id: 1,
    name: 'Chaos Mage',
    image: cardImg,
    atk: 18,
    def: 16,
    cost: 3,
    type: 'unit',
    race: 'mage',
    damage: 'otherworldly',
    // effect: 'Mages adjacent to this unit gain 1x Empower and their attacks are treated as Fire. On summon, this card gains 1x Intangible.',
    description: 'Adjacent Mage unit attacks are treated as Fire damage.',
    rarity: 'common',
    effects: [
      {
        effect: 'damage_type',
        ongoing: true,
        options: {
          damageType: 'fire',
        },
        trigger: Event.UNIT_SUMMONED,
        target: [
          { comparitor: 'equals', key: 'race', value: 'mage' },
          { combinator: 'and', comparitor: 'equals', key: 'location.type', value: 'unit' },
          { combinator: 'and', comparitor: 'owner', value: 'player' },
          { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
          { combinator: 'and', comparitor: 'adjacent' },
        ],
      },
    ],
  },
  {
    id: 2,
    name: 'Torch Mage',
    image: cardImg,
    atk: 10,
    def: 7,
    cost: 2,
    type: 'unit',
    race: 'mage',
    damage: 'fire',
    description: "Once per turn you can apply 2x burn to an opponent's unit",
    rarity: 'rare',
    effects: [
      {
        effect: 'debuff',
        eventName: Event.BURN_APPLIED,
        options: {
          debuff: 'burn',
          value: 2,
        },
        trigger: 'manual',
        persistent: true,
        optional: true,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        target: [
          { comparitor: 'equals', key: 'location.type', value: 'unit' },
          { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player' },
          { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
        ],
      },
    ],
  },
  {
    id: 4,
    name: 'Dante',
    image: cardImg,
    atk: 19,
    def: 15,
    cost: 3,
    type: 'unit',
    race: 'warrior',
    damage: 'fire',
    description: 'At the start of your turn, apply 1x Cleanse to this card',
    rarity: 'rare',
    effects: [
      {
        effect: 'buff',
        eventName: Event.CLEANSE_APPLIED,
        options: {
          buff: 'cleanse',
          value: 1,
        },
        trigger: Event.TURN_START,
        persistent: true,
        optional: false,
        activateOnOwnerTurn: true,
        target: [{ comparitor: 'itself' }],
      },
    ],
  },
  {
    id: 21,
    name: 'Book of Arcane',
    image: effectImg,
    cost: 0,
    type: 'effect',
    description: 'If you control a Mage unit, you can add one spent unit to your hand.',
    effects: [
      {
        effect: 'add_to_hand',
        trigger: 'manual',
        conditions: [
          {
            test: 'has_card',
            checks: [
              { comparitor: 'equals', key: 'race', value: 'mage' },
              { combinator: 'and', comparitor: 'equals', key: 'location.type', value: 'unit' },
              { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player' },
            ],
          },
        ],
        target: [
          { comparitor: 'equals', key: 'location.type', value: 'spent' },
          { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player' },
          { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
        ],
      },
    ],
  },
  {
    id: 27,
    name: 'Magic shield',
    image: trapImg,
    cost: 1,
    type: 'trap',
    description: 'When an opponent attacks one of your units, negate the attack.',
    effects: [
      {
        trigger: Event.TARGETED_ATTACK,
        conditions: [
          {
            test: 'event_target',
            checks: [
              { comparitor: 'equals', key: 'location.type', value: 'unit' },
              { combinator: 'and', comparitor: 'owner', value: 'player' },
              { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
            ],
          },
        ],
        spentOnUse: true,
        effect: 'negate_attack',
        optional: true,
        eventName: Event.TRAP_ACTIVATED,
      },
    ],
  },
  // {
  //   id: 1,
  //   name: 'Warrior',
  //   image: cardImg,
  //   atk: 10,
  //   def: 10,
  //   cost: 1,
  //   type: 'unit',
  //   race: 'warrior',
  //   damage: 'physical',
  //   description: 'A strong guy',
  //   effect: 'He kills people',
  //   rarity: 'common',
  //   location: { id: 'deck1', type: 'deck', index: 2, player: 'player1', name: 'Deck' } as Location,
  //   owner: 'player1',
  //   buffs: {},
  //   debuffs: {},
  //   faceUp: false,
  //   defensePosition: false,
  // },
  // {
  //   id: 3,
  //   gameId: '3',
  //   name: 'Dragon',
  //   image: cardImg,
  //   atk: 12,
  //   def: 8,
  //   cost: 2,
  //   type: 'unit',
  //   race: 'dragon',
  //   damage: 'void',
  //   description: 'A fire breathing dragon',
  //   effect: 'He kills people',
  //   rarity: 'rare',
  //   location: { id: 'deck2', type: 'deck', index: 3, player: 'player2', name: 'Deck' } as Location,
  //   owner: 'player2',
  //   buffs: {},
  //   debuffs: {},
  //   faceUp: false,
  //   defensePosition: false,
  // },
  // {
  //   id: 3,
  //   gameId: '4',
  //   name: 'Fire Dragon',
  //   image: cardImg,
  //   atk: 12,
  //   def: 8,
  //   cost: 2,
  //   type: 'unit',
  //   race: 'dragon',
  //   damage: 'fire',
  //   description: 'A fire breathing dragon',
  //   effect: "Adjacent dragon's attacks are treated as fire damage",
  //   rarity: 'rare',
  //   location: { id: 'deck2', type: 'deck', index: 4, player: 'player2', name: 'Deck' } as Location,
  //   owner: 'player2',
  //   buffs: {},
  //   debuffs: {},
  //   faceUp: false,
  //   defensePosition: false,
  //   effects: [
  //     {
  //       effect: 'damage_type',
  //       ongoing: true,
  //       options: {
  //         damageType: 'fire',
  //       },
  //       trigger: Event.UNIT_SUMMONED,
  //       target: [
  //         { comparitor: 'equals', key: 'race', value: 'dragon' },
  //         { combinator: 'and', comparitor: 'equals', key: 'location.type', value: 'unit' },
  //         { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player2' },
  //         { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
  //         { combinator: 'and', comparitor: 'adjacent' },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: 2,
  //   gameId: '5',
  //   name: 'Warrior Effect',
  //   image: effectImg,
  //   cost: 0,
  //   type: 'effect',
  //   description: 'If you control a Warrior unit, you can add one spent unit to your hand.',
  //   location: { id: 'deck1', type: 'deck', index: 3, player: 'player1', name: 'Deck' } as Location,
  //   owner: 'player1',
  //   buffs: {},
  //   debuffs: {},
  //   faceUp: false,
  //   defensePosition: false,
  //   effects: [
  //     {
  //       effect: 'add_to_hand',
  //       trigger: 'manual',
  //       conditions: [
  //         {
  //           test: 'has_card',
  //           checks: [
  //             { comparitor: 'equals', key: 'race', value: 'warrior' },
  //             { combinator: 'and', comparitor: 'equals', key: 'location.type', value: 'unit' },
  //             { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player1' },
  //           ],
  //         },
  //       ],
  //       target: [
  //         { comparitor: 'equals', key: 'location.type', value: 'spent' },
  //         { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player1' },
  //         { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: 2,
  //   gameId: '6',
  //   name: 'Dragon Effect',
  //   image: effectImg,
  //   cost: 0,
  //   type: 'effect',
  //   description: 'If you control a Dragon unit, you can add one spent unit to your hand.',
  //   location: { id: 'deck2', type: 'deck', index: 2, player: 'player2', name: 'Deck' } as Location,
  //   owner: 'player2',
  //   buffs: {},
  //   debuffs: {},
  //   faceUp: false,
  //   defensePosition: false,
  //   effects: [
  //     {
  //       effect: 'add_to_hand',
  //       trigger: 'manual',
  //       conditions: [
  //         {
  //           test: 'has_card',
  //           checks: [
  //             { comparitor: 'equals', key: 'race', value: 'dragon' },
  //             { combinator: 'and', comparitor: 'equals', key: 'location.type', value: 'unit' },
  //             { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player2' },
  //           ],
  //         },
  //       ],
  //       target: [
  //         { comparitor: 'equals', key: 'location.type', value: 'spent' },
  //         { combinator: 'and', comparitor: 'equals', key: 'owner', value: 'player2' },
  //         { combinator: 'and', comparitor: 'equals', key: 'type', value: 'unit' },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   id: 3,
  //   gameId: '7',
  //   name: 'Trap',
  //   image: trapImg,
  //   cost: 0,
  //   type: 'trap',
  //   description: 'Negate an attack',
  //   location: { id: 'deck1', type: 'deck', index: 4, player: 'player1', name: 'Deck' } as Location,
  //   owner: 'player1',
  //   buffs: {},
  //   debuffs: {},
  //   faceUp: false,
  //   defensePosition: false,
  //   effects: [
  //     { trigger: Event.TARGETED_ATTACK, effect: 'negate_attack', optional: true, eventName: Event.TRAP_ACTIVATED },
  //   ],
  // },
]
