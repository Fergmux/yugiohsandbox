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
  test?: 'has_card' | 'event_target' | 'event_source' | 'has_property' | 'has_energy' | 'trigger_effect'
  checks?: Check[][]
}
export type Check = {
  combinator?: 'and' | 'or'
  comparitor: Comparator
  key?: NestedKeyOf<GameCard> | NestedKeyOf<EffectDef>
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
  options?: Record<string, string | number | { key?: string; count?: number; countChecks?: Check[][] }[]>
  selectCount?: number // Number of cards to select, undefined will auto select all targets (unless optional is true)
  conditions?: Condition[]
  targets?: Check[][]
  optional?: boolean // Falsey will not prompt selection
  /** Only needed for simple handlers that don't emit their own events (e.g. negate_spend, negate_attack). Handlers that select targets should emit events per-target internally. */
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
  /** Follow-up effect that only runs if this effect resolved successfully (not negated/cancelled). */
  then?: EffectDef
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

const setTrap: EffectDef = {
  name: 'Set',
  effect: 'set_trap',
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
}

const summon: EffectDef = {
  name: 'Summon',
  effect: 'summon',
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
}

const sacrifice: EffectDef = {
  name: 'Sacrifice',
  effect: 'sacrifice',
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
}

const swapStance: EffectDef = {
  name: 'Swap Stance',
  effect: 'swap_stance',
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
}

const attack: EffectDef = {
  name: 'Attack',
  effect: 'damage',
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
}

export const defaultUnitEffects: EffectDef[] = [summon, sacrifice, swapStance, attack]

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
    description:
      "On summon Adjacent Mage units gain 2x Empower and this card gains 1x Eternal. Adjacent mage unit's attacks are treated as Fire",
    rarity: 'common',
    effects: [
      ...defaultUnitEffects,
      {
        name: 'Empower',
        effect: 'buff',

        options: {
          buffs: [{ key: 'empower', count: 2 }],
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

        options: {
          buffs: [{ key: 'eternal', count: 1 }],
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
      ...defaultUnitEffects,
      {
        name: 'Apply Burn',
        effect: 'debuff',

        options: {
          debuffs: [{ key: 'burn', count: 2 }],
        },
        trigger: 'manual',
        optional: true,
        selectCount: 1,
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
      ...defaultUnitEffects,
      {
        name: 'Piercing',
        effect: 'buff',

        options: {
          buffs: [{ key: 'piercing', count: 1 }],
        },
        trigger: 'manual',
        optional: true,
        selectCount: 1,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        targets: [[{ comparitor: 'location', value: 'adjacent' }]],
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
      ...defaultUnitEffects,
      {
        effect: 'buff',

        options: {
          buffs: [{ key: 'cleanse', count: 1 }],
        },
        trigger: Event.TURN_START,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
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
      ...defaultUnitEffects,
      {
        name: 'Apply Burn',
        effect: 'debuff',

        options: {
          debuffs: [{ key: 'burn', count: 1 }],
        },
        trigger: 'manual',
        optional: true,
        selectCount: 1,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        targets: [[{ comparitor: 'location', value: 'column' }]],
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
      ...defaultUnitEffects,
      {
        name: 'Apply Blind',
        effect: 'debuff',

        options: {
          debuffs: [{ key: 'blind', count: 1 }],
        },
        trigger: 'manual',
        optional: true,
        selectCount: 1,
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
      ...defaultUnitEffects,
      {
        name: 'Evasive',
        effect: 'buff',

        options: {
          buffs: [{ key: 'evasive', count: 1 }],
        },
        trigger: 'manual',
        optional: true,
        resetOnEvent: Event.TURN_START,
        selectCount: 1,
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
      ...defaultUnitEffects,
      {
        name: 'Empower',
        effect: 'buff',

        options: {
          buffs: [
            { key: 'empower', count: 1 },
            { key: 'shield', count: 1 },
          ],
        },
        trigger: Event.TURN_START,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'location', value: 'adjacent' }]],
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
      ...defaultUnitEffects,
      {
        name: 'Empower',
        effect: 'buff',

        options: {
          buffs: [{ key: 'empower', count: 2 }],
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
      ...defaultUnitEffects,
      {
        name: 'Apply Burn',
        effect: 'debuff',

        options: {
          debuffs: [{ key: 'burn', count: 1 }],
        },
        trigger: 'manual',
        optional: true,
        selectCount: 1,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        activations: 0,
        targets: [[{ comparitor: 'location', value: 'column' }]],
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
    description: "At the start of your turn, your units in this unit's column gain x1 shield",
    rarity: 'common',
    effects: [
      ...defaultUnitEffects,
      {
        name: 'Shield',
        effect: 'buff',

        options: {
          buffs: [{ key: 'shield', count: 1 }],
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
      ...defaultUnitEffects,
      {
        name: 'Weak',
        effect: 'debuff',

        options: {
          debuffs: [
            {
              key: 'weak',
              countChecks: [
                [
                  { comparitor: 'location', value: 'adjacent' },
                  { comparitor: 'equals', key: 'location.type', value: 'unit' },
                ],
              ],
            },
          ],
        },
        trigger: Event.TURN_START,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [[{ comparitor: 'itself' }]],
      },
      {
        name: 'Cursed',
        effect: 'debuff',

        options: {
          debuffs: [{ key: 'cursed', count: 99 }],
        },
        trigger: Event.UNIT_SUMMONED,
        triggerConditions: [[{ comparitor: 'itself' }]],
        targets: [[{ comparitor: 'itself' }]],
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
      ...defaultUnitEffects,
      {
        name: 'Anger',
        effect: 'buff',

        options: {
          buffs: [{ key: 'anger', count: 1 }],
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
    ],
  },
  // 14: Steadfast Knight
  {
    id: 14,
    name: 'Steadfast Knight',
    image: cardImg,
    atk: 6,
    def: 5,
    cost: 1,
    type: 'unit',
    race: 'warrior',
    damage: 'physical',
    description: 'Cannot be destroyed by battle with a monster that has more than 15 ATK',
    rarity: 'common',
    effects: [
      ...defaultUnitEffects,
      {
        name: 'no_spend',
        effect: 'negate_spend',
        eventName: Event.UNIT_ABILITY_ATTEMPTED,
        conditions: [
          {
            test: 'event_source',
            checks: [[{ comparitor: 'more_than', key: 'atk', value: 15 }]],
          },
        ],
        trigger: Event.UNIT_DEFEATED,
        triggerConditions: [[{ comparitor: 'itself' }]],
      },
    ],
  },
  // 15: Flat Foot
  {
    id: 15,
    name: 'Flat Foot',
    image: cardImg,
    atk: 3,
    def: 4,
    cost: 1,
    type: 'unit',
    race: 'warrior',
    damage: 'physical',
    description:
      'At the start of your turn, apply x1 Empower to your Warrior units in this column. Once per turn you can flip one trap on the field face up.',
    rarity: 'common',
    effects: [
      ...defaultUnitEffects,
      {
        name: 'Empower',
        effect: 'buff',

        options: {
          buffs: [{ key: 'empower', count: 1 }],
        },
        trigger: Event.TURN_START,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [
          [
            { comparitor: 'equals', key: 'race', value: 'warrior' },
            { comparitor: 'location', value: 'column' },
          ],
        ],
      },
      {
        name: 'Flip Trap',
        effect: 'flip_card',
        trigger: 'manual',
        activations: 0,
        resetOnEvent: Event.TURN_START,
        uses: 1,
        optional: true,
        selectCount: 1,
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'unit' }]],
          },
        ],
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [
          [
            { comparitor: 'equals', key: 'type', value: 'trap' },
            { comparitor: 'equals', key: 'location.type', value: 'trap' },
            { comparitor: 'owner', value: 'opponent' },
            { comparitor: 'equals', key: 'faceUp', value: false },
          ],
        ],
      },
    ],
  },
  // 19: Dragon's Wrath
  {
    id: 19,
    name: 'Swoop from above',
    image: effectImg,
    cost: 0,
    type: 'effect',
    description: 'If you control a Dragon unit, destroy a traps and if you do inflict 2HP damage.',
    effects: [
      {
        name: 'Activate',
        effect: 'move_card',
        trigger: 'manual',
        spentOnUse: true,
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        options: {
          destination: 'spent',
        },
        optional: true,
        selectCount: 1,
        targets: [
          [
            { comparitor: 'equals', key: 'type', value: 'trap' },
            { comparitor: 'equals', key: 'location.type', value: 'trap' },
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
                { comparitor: 'equals', key: 'race', value: 'dragon' },
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
                { comparitor: 'owner', value: 'player' },
              ],
            ],
          },
        ],
        then: {
          effect: 'direct_damage',
          options: { amount: 2, target: 'opponent' },
        },
      },
    ],
  },
  // 20: Huddle Up
  {
    id: 20,
    name: 'Huddle Up',
    image: effectImg,
    cost: 0,
    type: 'effect',
    description: 'Apply 1x Shield to your Warrior units for each Warrior unit on your field.',
    effects: [
      {
        eventName: Event.EFFECT_PLAYED,
        name: 'Activate',
        effect: 'buff',
        trigger: 'manual',
        spentOnUse: true,
        options: {
          buffs: [
            {
              key: 'shield',
              countChecks: [
                [
                  { comparitor: 'equals', key: 'race', value: 'warrior' },
                  { comparitor: 'equals', key: 'location.type', value: 'unit' },
                  { comparitor: 'owner', value: 'player' },
                ],
              ],
            },
          ],
        },
        conditions: [
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'hand' }]],
          },
        ],
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        targets: [
          [
            { comparitor: 'equals', key: 'location.type', value: 'unit' },
            { comparitor: 'owner', value: 'player' },
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
        trigger: 'manual',
        triggerConditions: [[{ comparitor: 'current_player', value: 'player' }]],
        options: {
          destination: 'hand',
        },
        selectCount: 1,
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
  // 25: Spell Breaker - Unit
  {
    id: 25,
    name: 'Spell Breaker - Unit',
    image: trapImg,
    cost: 0,
    type: 'trap',
    description: "When an opponent plays an Effect that doesn't select a unit, negate the acitviation",
    effects: [
      setTrap,
      {
        eventName: Event.TRAP_ACTIVATED,
        trigger: Event.EFFECT_PLAYED,
        conditions: [
          {
            test: 'trigger_effect',
            checks: [[{ comparitor: 'is_undefined', key: 'selectCount' }]],
          },
          {
            test: 'has_property',
            checks: [[{ comparitor: 'equals', key: 'location.type', value: 'trap' }]],
          },
        ],
        spentOnUse: true,
        effect: 'negate_effect',
        optional: true,
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
      setTrap,
      {
        eventName: Event.TRAP_ACTIVATED,
        trigger: Event.ATTACK_DECLARED,
        conditions: [
          {
            test: 'event_target',
            checks: [
              [
                { comparitor: 'equals', key: 'location.type', value: 'unit' },
                { comparitor: 'owner', value: 'opponent' },
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
      },
    ],
  },
]
