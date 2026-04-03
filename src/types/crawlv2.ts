import type { GameCard } from './cards'

export interface Card {
  name: string
  image: string
}

export type ZoneType = 'hand' | 'power' | 'unit' | 'leader' | 'trap' | 'empty' | 'deck' | 'spent' | 'dead'

export type Location = {
  id: string
  type: ZoneType
  index: number
  player: 'player1' | 'player2' | null
  name: string | null
  adjacent?: string[]
  neighbouring?: string[]
  column?: string[]
}

export interface GameState {
  cards: GameCard[]
  turn: number
  currentPlayer: 'player1' | 'player2'
  player1HP: number
  player2HP: number
  player1AP: number
  player2AP: number
}

export const indexableZones = ['hand', 'power', 'unit', 'trap']
export const fieldZones = ['power', 'unit', 'trap']

export const getLocationId = (type: ZoneType, index: number, player: 'player1' | 'player2' | null) => {
  return `${type}${player === 'player1' ? '1' : '2'}${indexableZones.includes(type) ? index : ''}`
}

export const locations: Location[] = [
  // Row 1

  { id: 'hand11', type: 'hand', index: 1, player: 'player1', name: 'Hand' },
  { id: 'hand12', type: 'hand', index: 2, player: 'player1', name: 'Hand' },
  { id: 'hand13', type: 'hand', index: 3, player: 'player1', name: 'Hand' },
  { id: 'hand14', type: 'hand', index: 4, player: 'player1', name: 'Hand' },
  { id: 'hand15', type: 'hand', index: 5, player: 'player1', name: 'Hand' },
  { id: 'hand16', type: 'hand', index: 6, player: 'player1', name: 'Hand' },
  { id: 'hand17', type: 'hand', index: 7, player: 'player1', name: 'Hand' },

  // Row 2
  { id: 'empty11', type: 'empty', index: 1, player: null, name: null },
  { id: 'empty12', type: 'empty', index: 2, player: null, name: null },
  { id: 'trap11', type: 'trap', index: 1, player: 'player1', name: 'Trap' },
  { id: 'trap12', type: 'trap', index: 2, player: 'player1', name: 'Trap' },
  { id: 'trap13', type: 'trap', index: 3, player: 'player1', name: 'Trap' },
  { id: 'empty13', type: 'empty', index: 3, player: null, name: null },
  { id: 'empty14', type: 'empty', index: 4, player: null, name: null },

  // Row 3
  { id: 'leader1', type: 'leader', index: 1, player: 'player1', name: 'Leader' },
  { id: 'deck1', type: 'deck', index: 1, player: 'player1', name: 'Deck' },
  {
    id: 'unit11',
    type: 'unit',
    index: 1,
    player: 'player1',
    name: 'Unit',
    adjacent: ['unit12', 'unit15', 'unit16'],
    neighbouring: ['unit12'],
    column: ['unit14', 'unit21', 'unit24'],
  },
  {
    id: 'unit12',
    type: 'unit',
    index: 2,
    player: 'player1',
    name: 'Unit',
    adjacent: ['unit11', 'unit13', 'unit14', 'unit15', 'unit16'],
    neighbouring: ['unit11', 'unit13'],
    column: ['unit15', 'unit22', 'unit25'],
  },
  {
    id: 'unit13',
    type: 'unit',
    index: 3,
    player: 'player1',
    name: 'Unit',
    adjacent: ['unit12', 'unit15', 'unit16'],
    neighbouring: ['unit12'],
    column: ['unit16', 'unit23', 'unit26'],
  },
  { id: 'power11', type: 'power', index: 1, player: 'player1', name: 'Power' },
  { id: 'power12', type: 'power', index: 2, player: 'player1', name: 'Power' },

  // Row 4

  { id: 'dead1', type: 'dead', index: 1, player: 'player1', name: 'Dead' },
  { id: 'spent1', type: 'spent', index: 1, player: 'player1', name: 'Spent' },
  {
    id: 'unit14',
    type: 'unit',
    index: 4,
    player: 'player1',
    name: 'Unit',
    adjacent: ['unit11', 'unit12', 'unit15'],
    neighbouring: ['unit15'],
    column: ['unit11', 'unit21', 'unit24'],
  },
  {
    id: 'unit15',
    type: 'unit',
    index: 5,
    player: 'player1',
    name: 'Unit',
    adjacent: ['unit11', 'unit12', 'unit13', 'unit14', 'unit16'],
    neighbouring: ['unit14', 'unit16'],
    column: ['unit12', 'unit22', 'unit25'],
  },
  {
    id: 'unit16',
    type: 'unit',
    index: 6,
    player: 'player1',
    name: 'Unit',
    adjacent: ['unit12', 'unit13', 'unit15'],
    neighbouring: ['unit15'],
    column: ['unit13', 'unit23', 'unit26'],
  },
  { id: 'power13', type: 'power', index: 3, player: 'player1', name: 'Power' },
  { id: 'power14', type: 'power', index: 4, player: 'player1', name: 'Power' },

  // Row 5
  { id: 'empty1', type: 'empty', index: 1, player: null, name: null },
  { id: 'empty2', type: 'empty', index: 2, player: null, name: null },
  { id: 'empty3', type: 'empty', index: 3, player: null, name: null },
  { id: 'empty4', type: 'empty', index: 4, player: null, name: null },
  { id: 'empty5', type: 'empty', index: 5, player: null, name: null },
  { id: 'empty6', type: 'empty', index: 6, player: null, name: null },
  { id: 'empty7', type: 'empty', index: 7, player: null, name: null },

  // Row 6
  { id: 'power21', type: 'power', index: 1, player: 'player2', name: 'Power' },
  { id: 'power22', type: 'power', index: 2, player: 'player2', name: 'Power' },
  {
    id: 'unit21',
    type: 'unit',
    index: 1,
    player: 'player2',
    name: 'Unit',
    adjacent: ['unit22', 'unit25', 'unit26'],
    neighbouring: ['unit22'],
    column: ['unit24', 'unit11', 'unit14'],
  },
  {
    id: 'unit22',
    type: 'unit',
    index: 2,
    player: 'player2',
    name: 'Unit',
    adjacent: ['unit21', 'unit23', 'unit24', 'unit25', 'unit26'],
    neighbouring: ['unit21', 'unit23'],
    column: ['unit25', 'unit12', 'unit15'],
  },
  {
    id: 'unit23',
    type: 'unit',
    index: 3,
    player: 'player2',
    name: 'Unit',
    adjacent: ['unit22', 'unit25', 'unit26'],
    neighbouring: ['unit22'],
    column: ['unit26', 'unit13', 'unit16'],
  },
  { id: 'spent2', type: 'spent', index: 1, player: 'player2', name: 'Spent' },
  { id: 'dead2', type: 'dead', index: 1, player: 'player2', name: 'Dead' },

  // Row 7
  { id: 'power23', type: 'power', index: 3, player: 'player2', name: 'Power' },
  { id: 'power24', type: 'power', index: 4, player: 'player2', name: 'Power' },
  {
    id: 'unit24',
    type: 'unit',
    index: 4,
    player: 'player2',
    name: 'Unit',
    adjacent: ['unit21', 'unit22', 'unit25'],
    neighbouring: ['unit25'],
    column: ['unit21', 'unit14', 'unit11'],
  },
  {
    id: 'unit25',
    type: 'unit',
    index: 5,
    player: 'player2',
    name: 'Unit',
    adjacent: ['unit21', 'unit22', 'unit23', 'unit24', 'unit26'],
    neighbouring: ['unit24', 'unit26'],
    column: ['unit22', 'unit15', 'unit12'],
  },
  {
    id: 'unit26',
    type: 'unit',
    index: 6,
    player: 'player2',
    name: 'Unit',
    adjacent: ['unit22', 'unit23', 'unit25'],
    neighbouring: ['unit25'],
    column: ['unit23', 'unit16', 'unit13'],
  },
  { id: 'deck2', type: 'deck', index: 1, player: 'player2', name: 'Deck' },
  { id: 'leader2', type: 'leader', index: 1, player: 'player2', name: 'Leader' },

  // Row 8
  { id: 'empty21', type: 'empty', index: 1, player: null, name: null },
  { id: 'empty22', type: 'empty', index: 2, player: null, name: null },
  { id: 'trap21', type: 'trap', index: 1, player: 'player2', name: 'Trap' },
  { id: 'trap22', type: 'trap', index: 2, player: 'player2', name: 'Trap' },
  { id: 'trap23', type: 'trap', index: 3, player: 'player2', name: 'Trap' },
  { id: 'empty23', type: 'empty', index: 3, player: null, name: null },
  { id: 'empty24', type: 'empty', index: 4, player: null, name: null },

  // Row 9
  { id: 'hand21', type: 'hand', index: 1, player: 'player2', name: 'Hand' },
  { id: 'hand22', type: 'hand', index: 2, player: 'player2', name: 'Hand' },
  { id: 'hand23', type: 'hand', index: 3, player: 'player2', name: 'Hand' },
  { id: 'hand24', type: 'hand', index: 4, player: 'player2', name: 'Hand' },
  { id: 'hand25', type: 'hand', index: 5, player: 'player2', name: 'Hand' },
  { id: 'hand26', type: 'hand', index: 6, player: 'player2', name: 'Hand' },
  { id: 'hand27', type: 'hand', index: 7, player: 'player2', name: 'Hand' },
]
