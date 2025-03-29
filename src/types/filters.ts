import type { Ref } from 'vue'

export interface FilterSection {
  title: string
  options: FilterOption[]
}

export type FilterOption = string | FilterSection

export interface FilterStateBaseBase {
  /**
   * Reset the filter section to its default values
   * No effect if the filter is locked
   */
  reset: () => void
  /**
   * Helper to unlock the filter section
   */
  unlock: () => void
  /**
   * Helper to show or expand the filter section
   */
  show: (show: boolean) => void
}

export interface FilterStateBase extends FilterStateBaseBase {
  /**
   * Whether the filter section is locked
   */
  locked: Ref<boolean>
  /**
   * Whether the filter section is shown/expanded
   */
  shown: Ref<boolean>
}

export const extraDeckTypes = [
  'Fusion Monster',
  'Link Monster',
  'Pendulum Effect Fusion Monster',
  'Synchro Monster',
  'Synchro Pendulum Effect Monster',
  'Synchro Tuner Monster',
  'XYZ Monster',
  'XYZ Pendulum Effect Monster',
]

export const mainDeckTypes = [
  'Effect Monster',
  'Flip Effect Monster',
  'Flip Tuner Effect Monster',
  'Gemini Monster',
  'Normal Monster',
  'Normal Tuner Monster',
  'Pendulum Effect Monster',
  'Pendulum Effect Ritual Monster',
  'Pendulum Flip Effect Monster',
  'Pendulum Normal Monster',
  'Pendulum Tuner Effect Monster',
  'Ritual Effect Monster',
  'Ritual Monster',
  'Spell Card',
  'Spirit Monster',
  'Toon Monster',
  'Trap Card',
  'Tuner Monster',
  'Union Effect Monster',
]
export const otherDeckTypes = ['Skill Card', 'Token']

export const fusionTypes = ['Fusion Monster', 'Pendulum Effect Fusion Monster']
export const linkTypes = ['Link Monster']
export const pendulumTypes = [
  'Pendulum Effect Monster',
  'Pendulum Effect Fusion Monster',
  'Synchro Pendulum Effect Monster',
  'Pendulum Effect Ritual Monster',
  'Pendulum Flip Effect Monster',
  'Pendulum Normal Monster',
  'Pendulum Tuner Effect Monster',
]
export const synchroTypes = ['Synchro Monster', 'Synchro Pendulum Effect Monster', 'Synchro Tuner Monster']
export const xyzTypes = ['XYZ Monster', 'XYZ Pendulum Effect Monster']
export const normalTypes = ['Normal Monster', 'Normal Tuner Monster']
export const effectTypes = [
  'Effect Monster',
  'Flip Effect Monster',
  'Flip Tuner Effect Monster',
  'Gemini Monster',
  'Union Effect Monster',
  'Spirit Monster',
  'Toon Monster',
]
export const ritualTypes = ['Ritual Monster', 'Ritual Effect Monster']
export const tunerTypes = ['Tuner Monster', 'Normal Tuner Monster']
export const extraTunerTypes = ['Pendulum Tuner Effect Monster', 'Synchro Tuner Monster']

export const frameTypeOptions = [
  'Normal',
  'Effect',
  'Ritual',
  'Fusion',
  'Synchro',
  'XYZ',
  'Link',
  'Pendulum',
  'Spell',
  'Trap',
  'Token',
  'Skill',
]

export const formatOptions = [
  'Duel Links',
  'Common Charity',
  'Edison',
  'TCG',
  'OCG',
  'Master Duel',
  'GOAT',
  'OCG GOAT',
  'Speed Duel',
  'No Format',
]

export const cardTypeSections: FilterOption[] = [
  {
    title: 'Main Deck',
    options: [
      { title: 'Normal Monsters', options: normalTypes },
      { title: 'Effect Monsters', options: effectTypes },
      { title: 'Ritual Monsters', options: ritualTypes },
      { title: 'Tuner Monsters', options: tunerTypes },
      'Spell Card',
      'Trap Card',
    ],
  },
  {
    title: 'Extra Deck',
    options: [
      { title: 'Fusion Monsters', options: fusionTypes },
      { title: 'Synchro Monsters', options: synchroTypes },
      { title: 'XYZ Monsters', options: xyzTypes },
      { title: 'Link Monsters', options: linkTypes },
      { title: 'Pendulum Monsters', options: pendulumTypes },
      { title: 'Extra Tuner Monsters', options: extraTunerTypes },
    ],
  },
  {
    title: 'Other',
    options: ['Token', 'Skill Card'],
  },
]

const monsterRaces = [
  'Aqua',
  'Beast',
  'Beast-Warrior',
  'Creator-God',
  'Cyberse',
  'Dinosaur',
  'Divine-Beast',
  'Dragon',
  'Fairy',
  'Fiend',
  'Fish',
  'Illusion',
  'Insect',
  'Machine',
  'Plant',
  'Psychic',
  'Pyro',
  'Reptile',
  'Rock',
  'Sea Serpent',
  'Spellcaster',
  'Thunder',
  'Warrior',
  'Winged Beast',
  'Wyrm',
  'Zombie',
  'Other',
]
const spellRaces = ['Normal', 'Field', 'Equip', 'Quick-Play', 'Ritual', 'Continuous']
const trapRaces = ['Normal', 'Counter', 'Continuous']

export const raceSections: FilterOption[] = [
  { title: 'Monster Cards', options: monsterRaces },
  { title: 'Spell Cards', options: spellRaces },
  { title: 'Trap Cards', options: trapRaces },
]

export const attributeOptions = ['DARK', 'DIVINE', 'EARTH', 'FIRE', 'LIGHT', 'METAL', 'WATER', 'WIND']

export const banlistOptions = ['Forbidden', 'Limited', 'Allowed']

export const pendulumFrameTypeOptions = [
  'normal_pendulum',
  'effect_pendulum',
  'ritual_pendulum',
  'fusion_pendulum',
  'synchro_pendulum',
  'xyz_pendulum',
]

export const defaultLevelRange = { min: 0, max: 13 }
export const defaultAtkRange = { min: 0, max: 5000 }
export const defaultDefRange = { min: 0, max: 5000 }
export const defaultOcgReleaseDateRange = { min: '', max: '' }
export const defaultTcgReleaseDateRange = { min: '', max: '' }
