export enum Event {
  // Game flow
  UPDATED = 'updated',
  GAME_START = 'game_start',
  TURN_START = 'turn_start',
  TURN_END = 'turn_end',

  // Units
  UNIT_PLAYED = 'unit_played', // Negateable
  UNIT_SUMMONED = 'unit_summoned',
  UNIT_ATTACKED = 'unit_attacked', // Negateable
  UNIT_DEFEATED = 'unit_defeated', // Negateable
  UNIT_SPENT = 'unit_spent',
  UNIT_ABILITY_ATTEMPTED = 'unit_ability_attempted', // Negateable
  UNIT_ABILITY_SUCCESSFUL = 'unit_ability_successful',
  STANCE_SWAP_ATTEMPTED = 'unit_stance_swap_attempted', // Negateable
  STANCE_SWAP_SUCCESSFUL = 'unit_stance_swap_successful',
  SACRIFICE_ATTEMPTED = 'sacrifice_attempted', // Negateable
  SACRIFICE_SUCCESSFUL = 'sacrifice_successful',

  // Combat
  ATTACK_DECLARED = 'attack_declared', // Negateable
  ATTACK_SUCCESSFUL = 'attack_successful',
  DAMAGE_ATTEMPTED = 'damage_attempted', // Negateable
  DAMAGE_DEALT = 'damage_dealt',

  // Traps
  TRAP_PLAYED = 'trap_played', // Negateable
  TRAP_SET = 'trap_set',
  TRAP_ACTIVATED = 'trap_activated', // Negateable
  TRAP_SUCCESSFUL = 'trap_successful',

  // Effects
  EFFECT_PLAYED = 'effect_played', // Negateable
  EFFECT_APPLIED = 'effect_applied',

  // Powers
  POWER_PLAYED = 'power_played', // Negateable
  POWER_SET = 'power_set',
  POWER_ACTIVATED = 'power_activated', // Negateable
  POWER_SUCCESSFUL = 'power_successful',

  // Card movement
  CARD_MOVED = 'card_moved',
  CARD_LEFT_FIELD = 'card_left_field',
  CARD_DRAWN = 'card_drawn',
  CARD_SPENT = 'card_spent',
  CARD_FLIPPED = 'card_flipped',

  // Buffs
  BUFF_ATTEMPTED = 'buff_attempted', // Negateable
  CLEANSE_APPLIED = 'cleanse_applied',
  EMPOWER_APPLIED = 'empower_applied',
  evasive_APPLIED = 'evasive_applied',
  ETERNAL_APPLIED = 'eternal_applied',
  PIERCING_APPLIED = 'piercing_applied',
  SHIELD_APPLIED = 'shield_applied',
  INTANGIBLE_APPLIED = 'intangible_applied',
  DAMAGE_TYPE_APPLIED = 'damage_type_applied',

  // Debuffs
  DEBUFF_ATTEMPTED = 'debuff_attempted', // Negateable
  BURN_APPLIED = 'burn_applied',
  WEAK_APPLIED = 'weak_applied',
  BLIND_APPLIED = 'blind_applied',
  CURSED_APPLIED = 'cursed_applied',
  ANGER_APPLIED = 'anger_applied',
  RETAIN_APPLIED = 'retain_applied',
}
