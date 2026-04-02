<template>
  <div
    :style="{ backgroundImage: `url(${card.image})` }"
    class="group relative flex aspect-2/3 h-full items-center justify-center rounded-md border-2 border-gray-300 bg-contain bg-center bg-no-repeat text-xl font-bold text-black"
    :class="{ 'rotate-90': card.defensePosition }"
  >
    <p class="absolute top-[6%] left-[12%] text-xs font-bold" :class="{ 'text-white': isTrapOrEffect }">
      {{ card.name }}
    </p>
    <p
      class="absolute bottom-[8%] left-[21%] text-xs font-bold"
      :class="isBuffed('atk') ? 'text-green-400' : isDebuffed('atk') ? 'text-red-400' : 'text-white'"
    >
      {{ effective.atk }}
    </p>
    <p
      class="absolute right-[21%] bottom-[8%] text-xs font-bold"
      :class="isBuffed('def') ? 'text-green-400' : isDebuffed('def') ? 'text-red-400' : 'text-white'"
    >
      {{ effective.def }}
    </p>
    <p class="absolute top-[5%] right-[10%] text-sm font-bold text-white">{{ card.cost }}</p>
    <p class="absolute top-[65%] left-[13%] text-[7px]" :class="isBuffed('damage') ? 'text-green-400' : ''">
      {{ card.race }}-{{ effective.damage }}
    </p>
    <p class="absolute top-[72%] left-[13%] text-[7px]" :class="{ 'text-white': isTrapOrEffect }">
      {{ card.description }} - {{ card.effect }}
    </p>

    <!-- Buff / debuff badges -->
    <div class="absolute top-[50%] left-[10%] flex flex-wrap gap-[2px]">
      <div v-for="(value, key) in card.buffs" :key="'buff-' + key" class="group relative">
        <span class="block rounded bg-green-600 px-[3px] py-px text-[5px] leading-tight font-bold text-white">
          {{ buffBadgeLabel(String(key)) }}<template v-if="typeof value === 'number'">×{{ value }}</template>
        </span>
        <span
          class="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-0.5 rounded bg-black/80 px-1.5 py-0.5 text-[7px] whitespace-nowrap text-white group-hover:visible"
        >
          {{ buffDescription(String(key), value) }}
        </span>
      </div>

      <div v-for="(value, key) in card.debuffs" :key="'debuff-' + key" class="group relative">
        <span class="block rounded bg-red-600 px-[3px] py-px text-[5px] leading-tight font-bold text-white">
          {{ debuffBadgeLabel(String(key)) }}<template v-if="typeof value === 'number'">×{{ value }}</template>
        </span>
        <span
          class="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-0.5 rounded bg-black/80 px-1.5 py-0.5 text-[7px] whitespace-nowrap text-white group-hover:visible"
        >
          {{ debuffDescription(String(key), value) }}
        </span>
      </div>
    </div>

    <button
      v-if="canSwapStance"
      class="absolute right-1 bottom-1 z-20 rounded bg-black/80 px-1.5 py-0.5 text-[8px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black"
      @mousedown.stop
      @mouseup.stop
      @click.stop="emit('swap-stance', card)"
    >
      {{ card.defensePosition ? 'ATK' : 'DEF' }}
    </button>

    <button
      v-if="canActivateEffect"
      class="absolute bottom-1 left-1 z-20 rounded bg-amber-600/80 px-1.5 py-0.5 text-[8px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-amber-500"
      @mousedown.stop
      @mouseup.stop
      @click.stop="emit('activate-effect', card)"
    >
      Activate
    </button>
  </div>
</template>

<script setup lang="ts">
import { type GameCard } from '@/types/cards'
import { getEffective } from '@/composables/crawlv2/BuffSystem'
import { propOf } from '@/composables/crawlv2/CheckSystem'
import { computed } from 'vue'

const props = defineProps<{
  card: GameCard
  currentPlayer?: 'player1' | 'player2'
}>()
const emit = defineEmits<{
  (e: 'swap-stance', card: GameCard): void
  (e: 'activate-effect', card: GameCard): void
}>()

const effective = computed(() => getEffective(props.card))
const canSwapStance = computed(
  () => props.card.type === 'unit' && props.card.location.type === 'unit' && props.card.owner === props.currentPlayer,
)
const canActivateEffect = computed(
  () =>
    props.card.location.type === 'unit' &&
    (props.card.effects ?? []).some(
      (e) => e.trigger === 'manual' && (e.uses === undefined || (e.activations ?? 0) < e.uses),
    ) &&
    props.card.owner === props.currentPlayer,
)

const isTrapOrEffect = computed(() => ['trap', 'effect'].includes(props.card.type ?? ''))

const isBuffed = (key: keyof GameCard) => {
  const base = props.card[key]
  const eff = effective.value[key]
  return typeof base === 'number' ? (eff as number) > base : eff !== base
}

const isDebuffed = (key: keyof GameCard) => {
  const base = props.card[key]
  const eff = effective.value[key]
  return typeof base === 'number' && (eff as number) < base
}

const BUFF_LABELS: Record<string, string> = { damage: 'DMG', atk: 'ATK', def: 'DEF' }
const DEBUFF_LABELS: Record<string, string> = { burn: 'BURN', atk: 'ATK', def: 'DEF' }

const BUFF_DESCRIPTIONS: Record<string, (v: string | number) => string> = {
  damage: (v) => `Damage type changed to ${v}`,
  atk: (v) => `+${v} ATK`,
  def: (v) => `+${v} DEF`,
}

const DEBUFF_DESCRIPTIONS: Record<string, (v: string | number) => string> = {
  burn: (v) => `Burn ×${v}: deals 1 damage to owner when this unit attacks`,
  atk: (v) => `-${v} ATK`,
  def: (v) => `-${v} DEF`,
}

const buffBadgeLabel = (key: string) => BUFF_LABELS[propOf(key)] ?? propOf(key).toUpperCase().slice(0, 4)
const debuffBadgeLabel = (key: string) => DEBUFF_LABELS[key] ?? key.toUpperCase().slice(0, 4)

const buffDescription = (key: string, value: string | number) =>
  BUFF_DESCRIPTIONS[propOf(key)]?.(value) ?? `${propOf(key)}: ${value}`
const debuffDescription = (key: string, value: string | number) =>
  DEBUFF_DESCRIPTIONS[key]?.(value) ?? `${key}: ${value}`
</script>
