import type { Crawlv3StatusDefinition } from '@/types/crawlv3'

// Fallback list used when no status CSV is configured.
export const CRAWLV3_FALLBACK_STATUSES: Crawlv3StatusDefinition[] = [
  {
    id: 'empower',
    name: 'Empower',
    type: 'buff',
    description: 'Increases offensive pressure or attack output.',
  },
  {
    id: 'shield',
    name: 'Shield',
    type: 'buff',
    description: 'Adds defensive resilience or effective defence.',
  },
  {
    id: 'piercing',
    name: 'Piercing',
    type: 'buff',
    description: 'Lets excess damage push through defensive protection.',
  },
  {
    id: 'evasive',
    name: 'Evasive',
    type: 'buff',
    description: 'Makes the card harder to interact with directly.',
  },
  {
    id: 'cleanse',
    name: 'Cleanse',
    type: 'buff',
    description: 'Represents a positive cleansing or purification effect.',
  },
  {
    id: 'weak',
    name: 'Weak',
    type: 'debuff',
    description: 'Reduces offensive output or general strength.',
  },
  {
    id: 'burn',
    name: 'Burn',
    type: 'debuff',
    description: 'Represents ongoing damage or attrition.',
  },
  {
    id: 'blind',
    name: 'Blind',
    type: 'debuff',
    description: 'Represents impaired accuracy, awareness, or targeting.',
  },
  {
    id: 'cursed',
    name: 'Cursed',
    type: 'debuff',
    description: 'Represents a hostile lingering curse effect.',
  },
  {
    id: 'stun',
    name: 'Stun',
    type: 'debuff',
    description: 'Represents temporary disablement or loss of tempo.',
  },
]
