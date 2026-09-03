import type { Crawlv3Action, Crawlv3Player, Crawlv3StatusType, Crawlv3Zone } from '@/types/crawlv3'

export type { Crawlv3SpectatorPerspective } from '@/types/crawlv3'

export type PendingCrawlv3ActionBatch = {
  action: Crawlv3Action
  serverVersion: number | null
}

export type QueuedCrawlv3Action =
  | Omit<Extract<Crawlv3Action, { type: 'update_config' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'select_deck' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'set_ready' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'select_card' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'update_spectator_perspective' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'move_card' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'patch_card' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'set_player_stats' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'shuffle_deck' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'shuffle_discard_into_deck' }>, 'actionId'>
  | Omit<Extract<Crawlv3Action, { type: 'complete_game' }>, 'actionId'>

export type Crawlv3PileZone = Extract<Crawlv3Zone, 'deck' | 'extraDeck' | 'discard' | 'exhausted'>

export type Crawlv3DragState = {
  instanceId: string
  startX: number
  startY: number
  ghostX: number
  ghostY: number
  pointerOffsetX: number
  pointerOffsetY: number
  cardWidth: number
  cardHeight: number
  active: boolean
  previewFaceUp?: boolean
  previewRotated?: boolean
}

export type Crawlv3TooltipState = {
  cardId: string
  x: number
  y: number
}

export type OpenCrawlv3PileState = {
  owner: Crawlv3Player
  zone: Crawlv3PileZone
  visibleCardIds: string[] | null
}

export type Crawlv3CardStatusEntry = {
  id: string
  name: string
  description: string
  type: Crawlv3StatusType
  value: number
}

export type Crawlv3PlayerStatDrafts = Record<Crawlv3Player, { lifePoints: string; actionPoints: string }>
