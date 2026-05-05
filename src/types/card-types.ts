import type { Event } from './events.js'
import type { Location, LocationKeys } from './crawlv2.js'

export type Comparator =
  | 'equals'
  | 'not_equals'
  | 'less_than'
  | 'more_than'
  | 'location'
  | 'itself'
  | 'owner'
  | 'current_player'
  | 'is_undefined'
  | 'location_check'

export type EffectTrigger = Event | 'manual'

type NestedKeyOf<T, Prefix extends string = '', Depth extends 1[] = []> = Depth['length'] extends 3
  ? never
  : {
      [K in keyof T & string]: T[K] extends Record<string, number>
        ? `${Prefix}${K}`
        : T[K] extends object
          ? `${Prefix}${K}` | NestedKeyOf<T[K], `${Prefix}${K}.`, [...Depth, 1]>
          : `${Prefix}${K}`
    }[keyof T & string]

export type Condition = {
  test?: 'has_card' | 'event_target' | 'event_source' | 'has_property' | 'has_energy' | 'trigger_effect'
  checks?: Check[][]
}

export type Check = {
  combinator?: 'and' | 'or'
  comparitor: Comparator
  key?: NestedKeyOf<GameCard> | NestedKeyOf<EffectDef> | LocationKeys
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
  /** Additional target checks applied to subsequent selections, using the previously selected card as the source.
   *  When present, multi-select effects (selectCount >= 2) will select one card at a time,
   *  filtering remaining candidates through these checks after each pick. */
  matchSelection?: Check[][]
  /** Follow-up effect that only runs if this effect resolved successfully (not negated/cancelled). */
  then?: EffectDef
  /** Sibling effects that fire independently alongside this effect. Each can be individually negated. */
  and?: EffectDef[]
  /** Auto-resolve targets from event data instead of prompting for selection. */
  autoTarget?: 'event_source' | 'event_target'
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
  retain?: number
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
