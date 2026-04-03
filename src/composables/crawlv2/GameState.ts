import type { GameState } from '@/types/crawlv2'

let _gameState: GameState | null = null

export function registerGameState(gameState: GameState): void {
  _gameState = gameState
}

export function getGameState(): GameState {
  if (!_gameState) throw new Error('GameState not registered')
  return _gameState
}

export function clearGameState(): void {
  _gameState = null
}
