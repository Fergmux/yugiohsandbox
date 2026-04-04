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
  test?: 'has_card' | 'event_target' | 'has_property' | 'has_energy'
  checks?: Check[][]
}
export type Check = {
  combinator?: 'and' | 'or'
  comparitor: Comparator
  key?: NestedKeyOf<GameCard>
  value?: string | boolean | number
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
  name?: string
  trigger?: EffectTrigger
  effect: string
  ongoing?: boolean
  options?: Record<string, string | number>
  conditions?: Condition[]
  targets?: Check[][]
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
  /** Checks evaluated against the card that triggered the event (the source of the emit).
   *  Uses the same Check[][] format as targets — OR of AND groups.
   *  The "source" for these checks is the listening card, and the "candidate" is the trigger card. */
  triggerConditions?: Check[][]
  /** When present, the count of cards matching these checks is used as the effect value
   *  instead of options.value. Uses the same Check[][] format as targets. */
  valueChecks?: Check[][]
}

type Buff = {
  empower?: number
  eternal?: number
  piercing?: number
  burn?: number
  cleanse?: number
  shield?: number
  evasive?: number
  anger?: number
  intangible?: number
  damage_type?: string
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
  // 1: Chaos Mage
  {
    id: 1,
    name: 'Chaos Mage',
    image: cardImg,
    atk: 18,
    def: 16,
    cost: 3,
    type: 'unit',
    race: 'mage',
    damage: 'cosmic',
    // effect: 'Mages adjacent to this unit gain 2x Empower and their attacks are treated as Fire. On summon, this card gains 1x Intangible.',
    description:
      "On summon Adjacent Mage units gain 2x Empower and this card gains 1x Eternal. Adjacent mage unit's attacks are treated as Fire",
    rarity: 'common',
    effects: [
      {
        name: 'Empower',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'empower',
          value: 2,
        },
        targets: [
          [
            { comparitor: 'equals', key: 'race', value: 'mage' },
            { comparitor: 'location', value: 'adjacent' },
          ],
        ],
        trigger: Event.UNIT_SUMMONED,
        triggerConditions: [[{ comparitor: 'itself' }]],
      },
      {
        name: 'Eternal',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'eternal',
          value: 2,
        },
        targets: [[{ comparitor: 'itself' }]],
        trigger: Event.UNIT_SUMMONED,
        triggerConditions: [[{ comparitor: 'itself' }]],
      },
      {
        effect: 'damage_type',
        ongoing: true,
        options: {
          damageType: 'fire',
        },
        targets: [
          [
            { comparitor: 'equals', key: 'race', value: 'mage' },
            { comparitor: 'location', value: 'adjacent' },
          ],
        ],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 2: Torch Mage
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
        name: 'Apply Burn',
        effect: 'debuff',
        eventName: Event.DEBUFF_ATTEMPTED,
        options: {
          debuff: 'burn',
          value: 2,
        },
        trigger: 'manual',
        optional: true,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 3: Sports Mage
  {
    id: 3,
    name: 'Sports Mage',
    image: cardImg,
    atk: 4,
    def: 3,
    cost: 1,
    type: 'unit',
    race: 'mage',
    damage: 'physical',
    description: 'Once per turn, you can apply 1x Piercing to an Adjacent unit',
    rarity: 'common',
    effects: [
      {
        name: 'Piercing',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'piercing',
          value: 1,
          select: 1,
        },
        trigger: 'manual',
        optional: true,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        targets: [[{ comparitor: 'location', value: 'adjacent' }]],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 4: Dante
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
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'cleanse',
          value: 1,
        },
        trigger: Event.TURN_START,
        optional: false,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        optional: false,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 5: Tag Duo - F
  {
    id: 5,
    name: 'Tag Duo - F',
    image: cardImg,
    atk: 5,
    def: 2,
    cost: 1,
    type: 'unit',
    race: 'mage',
    damage: 'fire',
    description: "Once per turn, you can apply 1x Burn to an opponents unit in this unit's column",
    rarity: 'common',
    effects: [
      {
        name: 'Apply Burn',
        effect: 'debuff',
        eventName: Event.DEBUFF_ATTEMPTED,
        options: {
          debuff: 'burn',
          value: 1,
        },
        trigger: 'manual',
        optional: true,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        targets: [[{ comparitor: 'location', value: 'column' }]],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 6: Tag Duo - J
  {
    id: 6,
    name: 'Tag Duo - J',
    image: cardImg,
    atk: 1,
    def: 7,
    cost: 1,
    type: 'unit',
    race: 'mage',
    damage: 'magic',
    description: 'Once per turn, you can apply 1x Blind to an opponents unit',
    rarity: 'common',
    effects: [
      {
        name: 'Apply Blind',
        effect: 'debuff',
        eventName: Event.DEBUFF_ATTEMPTED,
        options: {
          debuff: 'blind',
          value: 1,
        },
        trigger: 'manual',
        optional: true,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 7	Cosmic Dragon
  {
    id: 7,
    name: 'Cosmic Dragon',
    image: cardImg,
    atk: 20,
    def: 15,
    cost: 3,
    type: 'unit',
    race: 'dragon',
    damage: 'cosmic',
    description: 'Once per turn, you can apply 1x Evasive to itself or an Adjacent Dragon unit',
    rarity: 'rare',
    effects: [
      {
        name: 'Evasive',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'evasive',
          value: 1,
          select: 1,
        },
        trigger: 'manual',
        optional: true,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        targets: [
          [
            { comparitor: 'equals', key: 'race', value: 'dragon' },
            { comparitor: 'location', value: 'adjacent' },
          ],
          [{ comparitor: 'itself' }],
        ],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
                { comparitor: 'owner', value: 'player' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 8: Captain
  {
    id: 8,
    name: 'Captain',
    image: cardImg,
    atk: 10,
    def: 12,
    cost: 2,
    type: 'unit',
    race: 'warrior',
    damage: 'physical',
    description: 'At the start of your turn, Adjacent warrior units gain 1x Empower / 1x Shield.',
    rarity: 'common',
    effects: [
      {
        name: 'Empower',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'empower',
          value: 1,
        },
        trigger: Event.TURN_START,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'location', value: 'adjacent' }]],
      },
      {
        name: 'Shield',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'shield',
          value: 1,
        },
        trigger: Event.TURN_START,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'location', value: 'adjacent' }]],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 9: Blue Crystal Dragon
  {
    id: 9,
    name: 'Blue Crystal Dragon',
    image: cardImg,
    atk: 19,
    def: 15,
    cost: 2,
    type: 'unit',
    race: 'dragon',
    damage: 'magic',
    description: "On summon, neighbouring Dragon unit's gain x2 Empower.",
    rarity: 'rare',
    effects: [
      {
        name: 'Empower',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'empower',
          value: 2,
        },
        targets: [
          [
            { comparitor: 'equals', key: 'race', value: 'dragon' },
            { comparitor: 'location', value: 'neighbouring' },
          ],
        ],
        trigger: Event.UNIT_SUMMONED,
        triggerConditions: [[{ comparitor: 'itself' }]],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 10: Fell Dragon
  {
    id: 10,
    name: 'Fell Dragon',
    image: cardImg,
    atk: 5,
    def: 2,
    cost: 1,
    type: 'unit',
    race: 'dragon',
    damage: 'fire',
    description: "Once per turn, you can apply 1x Burn to an opponents unit in this unit's column",
    rarity: 'common',
    effects: [
      {
        name: 'Apply Burn',
        effect: 'debuff',
        eventName: Event.DEBUFF_ATTEMPTED,
        options: {
          debuff: 'burn',
          value: 1,
        },
        trigger: 'manual',
        optional: true,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        targets: [[{ comparitor: 'location', value: 'column' }]],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 11: Cave Dragon
  {
    id: 11,
    name: 'Cave Dragon',
    image: cardImg,
    atk: 2,
    def: 7,
    cost: 1,
    type: 'unit',
    race: 'dragon',
    damage: 'fire',
    description: "At the start of your turn, your units in this unit's column gain x1 Endurance",
    rarity: 'common',
    effects: [
      {
        name: 'Endurance',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'shield',
          value: 1,
        },
        trigger: Event.TURN_START,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [
          [
            { comparitor: 'location', value: 'column' },
            { comparitor: 'owner', value: 'player' },
          ],
        ],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 12: Lone warrior
  {
    id: 12,
    name: 'Lone warrior',
    image: cardImg,
    atk: 15,
    def: 15,
    cost: 2,
    type: 'unit',
    race: 'warrior',
    damage: 'cosmic',
    description: 'At the start of your turn, gains x1 Weak for each Adjacent unit. On summon gains x99 cursed.',
    rarity: 'common',
    effects: [
      {
        name: 'Weak',
        effect: 'debuff',
        eventName: Event.DEBUFF_ATTEMPTED,
        options: {
          debuff: 'weak',
        },
        trigger: Event.TURN_START,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        valueChecks: [
          [
            { comparitor: 'location', value: 'adjacent' },
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
          ],
        ],
      },
      {
        name: 'Cursed',
        effect: 'debuff',
        eventName: Event.DEBUFF_ATTEMPTED,
        options: {
          debuff: 'cursed',
          value: 99,
        },
        trigger: Event.UNIT_SUMMONED,
        triggerConditions: [[{ comparitor: 'itself' }]],
        targets: [[{ comparitor: 'itself' }]],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 13: Rage Dragon
  {
    id: 13,
    name: 'Rage Dragon',
    image: cardImg,
    atk: 8,
    def: 4,
    cost: 1,
    type: 'unit',
    race: 'dragon',
    damage: 'physical',
    description: 'Once per turn, can apply 1x Anger to itself',
    rarity: 'rare',
    effects: [
      {
        name: 'Anger',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'anger',
          value: 1,
        },
        trigger: 'manual',
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        optional: true,
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        optional: false,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 14: Chaos Mage
  {
    id: 14,
    name: 'Steadfast Knight',
    image: cardImg,
    atk: 6,
    def: 5,
    cost: 1,
    type: 'unit',
    race: 'knight',
    damage: 'physical',
    description: 'Cannot be destroyed by battle with a monster that has more than 15 ATK',
    rarity: 'common',
    effects: [
      {
        name: 'no_spend',
        effect: 'negate_spend',
        eventName: Event.UNIT_ABILITY_ATTEMPTED,
        conditions: [
          {
            test: 'event_target',
            checks: [[{ comparitor: 'more_than', key: 'atk', value: 15 }]],
          },
        ],
        trigger: Event.UNIT_DEFEATED,
        triggerConditions: [[{ comparitor: 'itself' }]],
      },
      {
        name: 'Eternal',
        effect: 'buff',
        eventName: Event.BUFF_ATTEMPTED,
        options: {
          buff: 'eternal',
          value: 2,
        },
        targets: [[{ comparitor: 'itself' }]],
        trigger: Event.UNIT_SUMMONED,
        triggerConditions: [[{ comparitor: 'itself' }]],
      },
      {
        effect: 'damage_type',
        ongoing: true,
        options: {
          damageType: 'fire',
        },
        targets: [
          [
            { comparitor: 'equals', key: 'race', value: 'mage' },
            { comparitor: 'location', value: 'adjacent' },
          ],
        ],
      },
      {
        name: 'Summon',
        effect: 'summon',
        eventName: Event.UNIT_PLAYED,
        targets: [[{ comparitor: 'itself' }]],
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        name: 'Sacrifice',
        effect: 'sacrifice',
        eventName: Event.SACRIFICE_ATTEMPTED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'more_than', key: 'cost', value: 0 },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
      },
      {
        name: 'Swap Stance',
        effect: 'swap_stance',
        eventName: Event.STANCE_SWAP_ATTEMPTED,
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
      },
      {
        name: 'Attack',
        effect: 'damage',
        eventName: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'has_property',
            checks: [
              [
                { comparitor: 'equals', key: 'defensePosition', value: false },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
              ],
            ],
          },
        ],
        uses: 1,
        activations: 0,
        resetOnEvent: Event.TURN_START,
        trigger: 'manual',
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
      },
    ],
  },
  // 21: Book of Arcane
  {
    id: 21,
    name: 'Book of Arcane',
    image: effectImg,
    cost: 0,
    type: 'effect',
    description: 'If you control a Mage unit, you can add one spent unit to your hand.',
    effects: [
      {
        name: 'Activate',
        effect: 'move_card',
        eventName: Event.EFFECT_PLAYED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        options: {
          destination: 'hand',
          count: 1,
        },
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'spent' },
            { comparitor: 'owner', value: 'player' },
            { comparitor: 'equals', key: 'type', value: 'unit' },
          ],
        ],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
          {
            test: 'has_card',
            checks: [
              [
                { comparitor: 'equals', key: 'race', value: 'mage' },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
                { comparitor: 'owner', value: 'player' },
              ],
            ],
          },
        ],
      },
    ],
  },
  // 27: Magic shield
  {
    id: 27,
    name: 'Magic shield',
    image: trapImg,
    cost: 1,
    type: 'trap',
    description: 'When an opponent attacks one of your units, negate the attack.',
    effects: [
      {
        name: 'Set',
        effect: 'set_trap',
        eventName: Event.TRAP_PLAYED,
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
          {
            test: 'has_energy',
            checks: [[{ comparitor: 'more_than', key: 'cost' }], [{ comparitor: 'equals', key: 'cost' }]],
          },
        ],
      },
      {
        trigger: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'event_target',
            checks: [
              [
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
                { comparitor: 'owner', value: 'player' },
                { comparitor: 'equals', key: 'type', value: 'unit' },
              ],
            ],
          },
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'trap' }]],
          },
        ],
        spentOnUse: true,
        effect: 'negate_attack',
        optional: true,
        eventName: Event.TRAP_ACTIVATED,
      },
    ],
  },
]
