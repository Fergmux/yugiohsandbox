<template>
  <div
    :style="{ backgroundImage: `url(${cardImg})` }"
    class="group relative flex aspect-2/3 h-full items-center justify-center rounded-md border-2 border-gray-300 bg-contain bg-center bg-no-repeat text-xl font-bold text-black"
    :class="{ 'rotate-90': card.defensePosition }"
  >
    <template v-if="card.faceUp">
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
        {{ card.description }}
      </p>

      <!-- Buff / debuff badges -->
      <div v-if="card.faceUp" class="absolute top-[50%] left-[10%] flex flex-wrap gap-[2px]">
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

      <div
        v-if="effectButtons.length && !hasSelection"
        class="absolute bottom-1 left-1 z-20 flex flex-col items-start gap-px opacity-0 transition-opacity group-hover:opacity-100"
      >
        <button
          v-for="btn in effectButtons"
          :key="btn.index"
          class="rounded bg-amber-600/80 px-1.5 py-0.5 text-[8px] font-bold text-white hover:bg-amber-500"
          :class="{ 'cursor-not-allowed opacity-50 hover:bg-amber-600/80': !btn.enabled }"
          :disabled="!btn.enabled"
          @mousedown.stop
          @mouseup.stop
          @click.stop="btn.enabled && emit('activate-effect', card, btn.index)"
        >
          {{ btn.name }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { type GameCard, type EffectDef } from '@/types/cards'
import { getEffective } from '@/composables/crawlv2/BuffSystem'
import { propOf, filterByTargets, filterByChecks, evaluateConditions } from '@/composables/crawlv2/CheckSystem'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import CardBack from '@/assets/images/cards/cardback.png'
import { EventBus, Event } from '@/composables/crawlv2/EventBus'
import { useTargetSelector } from '@/composables/crawlv2/useTargetSelector'
import { getEffectiveUses } from '@/composables/crawlv2/buffs/AngerSystem'

const props = defineProps<{
  card: GameCard
  currentPlayer?: 'player1' | 'player2'
  allCards?: GameCard[]
}>()

const { hasSelection } = useTargetSelector()
const emit = defineEmits<{
  (e: 'activate-effect', card: GameCard, effectIndex: number): void
}>()

type EffectButton = { index: number; name: string; enabled: boolean }

// Bump this to force the computed to re-evaluate when non-reactive global state
// changes (e.g. other cards moving/dying that affect target availability).
const revision = ref(0)

const isEffectEnabled = (effect: EffectDef) => {
  const maxUses = getEffectiveUses(props.card, effect)
  if (maxUses !== undefined && (effect.activations ?? 0) >= maxUses) return false
  if (!evaluateConditions(effect.conditions, props.card)) return false
  if (!effect.targets?.length) return true
  let validTargets = filterByTargets(effect.targets, props.card)
  if (effect.effect === 'damage') {
    validTargets = validTargets.filter((t) => !(typeof t.buffs.evasive === 'number' && t.buffs.evasive > 0))
    const opponentUnits = filterByChecks(
      [
        [
          { comparitor: 'equals', key: 'location.type', value: 'unit' },
          { comparitor: 'owner', value: 'opponent' },
        ],
      ],
      props.card,
    )
    return validTargets.length > 0 || opponentUnits.length === 0
  }
  return validTargets.length > 0
}

const effectButtons = computed(() => {
  // Read revision so EventBus-triggered bumps cause re-evaluation
  void revision.value
  if (props.card.owner !== props.currentPlayer) return []
  return (props.card.effects ?? [])
    .map((effect, index) => {
      if (effect.trigger !== 'manual') return null
      return { index, name: effect.name ?? 'Activate', enabled: isEffectEnabled(effect) } as EffectButton
    })
    .filter((x): x is EffectButton => x !== null)
})

onMounted(() => {
  EventBus.on(Event.UPDATED, props.card.gameId, () => {
    revision.value++
  })
})

onUnmounted(() => {
  EventBus.off(Event.UPDATED, props.card.gameId)
})

const cardImg = computed(() => (props.card.faceUp ? props.card.image : CardBack))
const effective = computed(() => getEffective(props.card))

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

const BUFF_LABELS: Record<string, string> = {
  damage: 'DMG',
  cleanse: 'CLEANSE',
  atk: 'ATK',
  def: 'DEF',
  empower: 'EMPOWER',
  evasive: 'EVASIVE',
}
const DEBUFF_LABELS: Record<string, string> = {
  burn: 'BURN',
  atk: 'ATK',
  def: 'DEF',
  weak: 'WEAK',
  cursed: 'CURSED',
  blind: 'BLIND',
}

const BUFF_DESCRIPTIONS: Record<string, (v: string | number) => string> = {
  damage: (v) => `Damage type changed to ${v}`,
  cleanse: (v) => `Cleanse ×${v}: prevents debuffs`,
  atk: (v) => `+${v} ATK`,
  def: (v) => `+${v} DEF`,
  empower: (v) => `Empower ×${v}: +${v} ATK`,
  evasive: (v) => `Evasive ×${v}: untargetable by attacks`,
}

const DEBUFF_DESCRIPTIONS: Record<string, (v: string | number) => string> = {
  burn: (v) => `Burn ×${v}: deals 1 damage to owner when this unit attacks`,
  atk: (v) => `-${v} ATK`,
  def: (v) => `-${v} DEF`,
  weak: (v) => `Weak ×${v}: -${v} ATK`,
  cursed: (v) => `Cursed ×${v}: loses all buffs and debuffs`,
  blind: (v) => `Blind ×${v}: Cannot pick targets for attacks`,
}

const buffBadgeLabel = (key: string) => BUFF_LABELS[propOf(key)]
const debuffBadgeLabel = (key: string) => DEBUFF_LABELS[key]

const buffDescription = (key: string, value: string | number) =>
  BUFF_DESCRIPTIONS[propOf(key)]?.(value) ?? `${propOf(key)}: ${value}`
const debuffDescription = (key: string, value: string | number) =>
  DEBUFF_DESCRIPTIONS[key]?.(value) ?? `${key}: ${value}`
</script>
