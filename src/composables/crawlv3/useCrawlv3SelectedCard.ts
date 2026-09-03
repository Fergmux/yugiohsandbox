import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

import { formatDisplayValue, shouldShowCardStat } from '@/lib/crawlv3/card-display'
import type {
  Crawlv3CardState,
  Crawlv3Game,
  Crawlv3Player,
  Crawlv3StatusDefinition,
  Crawlv3StatusType,
} from '@/types/crawlv3'
import type { Crawlv3CardStatusEntry, Crawlv3PlayerStatDrafts, QueuedCrawlv3Action } from '@/types/crawlv3-ui'

type UseCrawlv3SelectedCardOptions = {
  game: ComputedRef<Crawlv3Game | null>
  myPlayer: ComputedRef<Crawlv3Player | null>
  statusDefinitions: Ref<Crawlv3StatusDefinition[]>
  selectedCardId: Ref<string | null>
  statusCardId: Ref<string | null>
  enqueueAction: (action: QueuedCrawlv3Action) => void
}

function parseNumericInput(value: string, fallback: number) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

export function useCrawlv3SelectedCard({
  game,
  myPlayer,
  statusDefinitions,
  selectedCardId,
  statusCardId,
  enqueueAction,
}: UseCrawlv3SelectedCardOptions) {
  const statDrafts = ref<Crawlv3PlayerStatDrafts>({
    player1: { lifePoints: '8000', actionPoints: '0' },
    player2: { lifePoints: '8000', actionPoints: '0' },
  })

  const selectedAtk = ref('')
  const selectedDef = ref('')
  const selectedRace = ref('')
  const selectedDamageType = ref('')
  const focusedSelectedStat = ref<'atk' | 'def' | null>(null)

  const selectedCard = computed(() => {
    if (!game.value || !selectedCardId.value) return null
    return game.value.cards[selectedCardId.value] ?? null
  })

  const selectedOwnCard = computed(() => {
    if (!selectedCard.value || !myPlayer.value) return null
    if (selectedCard.value.zone === 'deck') return null
    return selectedCard.value.owner === myPlayer.value ? selectedCard.value : null
  })

  const selectedOwnCardPreview = computed(() => {
    if (!selectedOwnCard.value) return null
    return {
      ...selectedOwnCard.value,
      rotated: false,
    }
  })

  const statusCard = computed(() => {
    if (!game.value || !statusCardId.value) return null
    return game.value.cards[statusCardId.value] ?? null
  })

  const statusDefinitionMap = computed(() =>
    Object.fromEntries(statusDefinitions.value.map((status) => [status.id, status])),
  )

  const statusLabels = computed(() =>
    Object.fromEntries(statusDefinitions.value.map((status) => [status.id, status.name])),
  )

  const raceOptions = computed(() => getUniqueCardValues('race'))
  const damageTypeOptions = computed(() => getUniqueCardValues('damageType'))

  function getUniqueCardValues(key: 'race' | 'damageType') {
    const values = Object.values(game.value?.cards ?? {})
      .map((card) => card[key].trim())
      .filter(Boolean)

    return [...new Set(values)].sort((left, right) => left.localeCompare(right))
  }

  function commitPlayerStats(
    player: Crawlv3Player,
    overrides: Partial<{ lifePoints: number; actionPoints: number }> = {},
  ) {
    const playerState = game.value?.players[player]
    if (!playerState) return

    const lifePoints =
      overrides.lifePoints ?? parseNumericInput(statDrafts.value[player].lifePoints, playerState.lifePoints)
    const actionPoints =
      overrides.actionPoints ?? parseNumericInput(statDrafts.value[player].actionPoints, playerState.actionPoints)

    statDrafts.value[player] = {
      lifePoints: String(lifePoints),
      actionPoints: String(actionPoints),
    }

    enqueueAction({
      type: 'set_player_stats',
      player,
      lifePoints,
      actionPoints,
    })
  }

  function savePlayerStats(player: Crawlv3Player) {
    commitPlayerStats(player)
  }

  function adjustLifePoints(player: Crawlv3Player, delta: number) {
    const playerState = game.value?.players[player]
    if (!playerState) return

    const nextValue = parseNumericInput(statDrafts.value[player].lifePoints, playerState.lifePoints) + delta
    commitPlayerStats(player, { lifePoints: nextValue })
  }

  function adjustActionPoints(player: Crawlv3Player, delta: number) {
    const playerState = game.value?.players[player]
    if (!playerState) return
    const nextValue = parseNumericInput(statDrafts.value[player].actionPoints, playerState.actionPoints) + delta
    commitPlayerStats(player, { actionPoints: nextValue })
  }

  function resetActionPoints(player: Crawlv3Player) {
    commitPlayerStats(player, { actionPoints: game.value?.config.defaultActionPoints ?? 0 })
  }

  function saveSelectedStat(stat: 'atk' | 'def') {
    if (!selectedOwnCard.value) return
    if (!shouldShowCardStat(selectedOwnCard.value, stat)) return

    const draftValue = stat === 'atk' ? selectedAtk.value : selectedDef.value
    const baseValue = stat === 'atk' ? selectedOwnCard.value.baseAtk : selectedOwnCard.value.baseDef
    const nextValue = draftValue.trim().length ? draftValue : formatDisplayValue(baseValue)
    if (stat === 'atk') {
      selectedAtk.value = nextValue
    } else {
      selectedDef.value = nextValue
    }

    if (nextValue === selectedOwnCard.value[stat]) return

    enqueueAction({
      type: 'patch_card',
      instanceId: selectedOwnCard.value.instanceId,
      patch: {
        [stat]: nextValue,
      },
    })
  }

  function blurSelectedStat(stat: 'atk' | 'def') {
    saveSelectedStat(stat)
    focusedSelectedStat.value = null
  }

  function saveSelectedDetail(detail: 'race' | 'damageType') {
    if (!selectedOwnCard.value) return

    const nextValue = detail === 'race' ? selectedRace.value : selectedDamageType.value
    if (nextValue === selectedOwnCard.value[detail]) return

    enqueueAction({
      type: 'patch_card',
      instanceId: selectedOwnCard.value.instanceId,
      patch: {
        [detail]: nextValue,
      },
    })
  }

  function toggleSelectedFace() {
    if (!selectedOwnCard.value) return
    enqueueAction({
      type: 'patch_card',
      instanceId: selectedOwnCard.value.instanceId,
      patch: {
        faceUp: !selectedOwnCard.value.faceUp,
      },
    })
  }

  function toggleSelectedRotation() {
    if (!selectedOwnCard.value) return
    enqueueAction({
      type: 'patch_card',
      instanceId: selectedOwnCard.value.instanceId,
      patch: {
        rotated: !selectedOwnCard.value.rotated,
      },
    })
  }

  function decrementCardStatus(instanceId: string, kind: Crawlv3StatusType, key: string) {
    const card = game.value?.cards[instanceId]
    if (!card || !myPlayer.value || card.owner !== myPlayer.value) return

    const nextRecord = {
      ...(kind === 'buff' ? card.buffs : card.debuffs),
    }

    const nextValue = (nextRecord[key] ?? 0) - 1
    if (nextValue > 0) {
      nextRecord[key] = nextValue
    } else {
      delete nextRecord[key]
    }

    enqueueAction({
      type: 'patch_card',
      instanceId,
      patch: kind === 'buff' ? { buffs: nextRecord } : { debuffs: nextRecord },
    })
  }

  function incrementCardStatus(instanceId: string, kind: Crawlv3StatusType, key: string) {
    const card = game.value?.cards[instanceId]
    if (!card || !myPlayer.value || card.owner !== myPlayer.value) return

    const nextRecord = {
      ...(kind === 'buff' ? card.buffs : card.debuffs),
    }
    nextRecord[key] = (nextRecord[key] ?? 0) + 1

    enqueueAction({
      type: 'patch_card',
      instanceId,
      patch: kind === 'buff' ? { buffs: nextRecord } : { debuffs: nextRecord },
    })
  }

  function saveSelectedStatuses(payload: { buffs: Record<string, number>; debuffs: Record<string, number> }) {
    if (!selectedOwnCard.value) return
    enqueueAction({
      type: 'patch_card',
      instanceId: selectedOwnCard.value.instanceId,
      patch: payload,
    })
    statusCardId.value = null
  }

  function getCardStatusEntries(card: Crawlv3CardState, type: Crawlv3StatusType): Crawlv3CardStatusEntry[] {
    const source = type === 'buff' ? card.buffs : card.debuffs
    const definitionOrder = new Map(statusDefinitions.value.map((status, index) => [status.id, index]))

    return Object.entries(source)
      .map(([id, value]) => ({
        id,
        name: statusDefinitionMap.value[id]?.name ?? id,
        description: statusDefinitionMap.value[id]?.description ?? '',
        type,
        value,
      }))
      .sort((left, right) => {
        const leftOrder = definitionOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER
        const rightOrder = definitionOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER
        return leftOrder - rightOrder || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
      })
  }

  function clearSelectedCardState() {
    selectedCardId.value = null
    statusCardId.value = null
  }

  watch(
    () => game.value?.players,
    (players) => {
      if (!players) return
      for (const key of ['player1', 'player2'] as const) {
        statDrafts.value[key] = {
          lifePoints: String(players[key]?.lifePoints ?? 0),
          actionPoints: String(players[key]?.actionPoints ?? 0),
        }
      }
    },
    { immediate: true, deep: true },
  )

  watch(
    () => selectedOwnCard.value,
    (card) => {
      if (focusedSelectedStat.value !== 'atk') selectedAtk.value = card?.atk ?? ''
      if (focusedSelectedStat.value !== 'def') selectedDef.value = card?.def ?? ''
      selectedRace.value = card?.race ?? ''
      selectedDamageType.value = card?.damageType ?? ''
    },
    { immediate: true },
  )

  watch(
    () => selectedCard.value,
    (card) => {
      if (!card && selectedCardId.value) {
        selectedCardId.value = null
      }
    },
  )

  watch(
    () => statusCard.value,
    (card) => {
      if (!card && statusCardId.value) {
        statusCardId.value = null
      }
    },
  )

  return {
    statDrafts,
    selectedAtk,
    selectedDef,
    selectedRace,
    selectedDamageType,
    focusedSelectedStat,
    selectedCard,
    selectedOwnCard,
    selectedOwnCardPreview,
    statusCard,
    statusLabels,
    raceOptions,
    damageTypeOptions,
    savePlayerStats,
    adjustLifePoints,
    adjustActionPoints,
    resetActionPoints,
    saveSelectedStat,
    blurSelectedStat,
    saveSelectedDetail,
    toggleSelectedFace,
    toggleSelectedRotation,
    decrementCardStatus,
    incrementCardStatus,
    saveSelectedStatuses,
    getCardStatusEntries,
    clearSelectedCardState,
  }
}
