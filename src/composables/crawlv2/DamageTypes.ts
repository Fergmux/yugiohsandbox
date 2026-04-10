// Re-export everything from shared lib — DamageTypes was already pure
export {
  TYPE_EFFECTIVENESS,
  TYPE_MULTIPLIER,
  getEffectiveDamageType,
  isTypeEffective,
  getTypeEffectiveAtk,
} from '@/lib/crawlv2/damage-types'
