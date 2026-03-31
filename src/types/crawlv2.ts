export interface Card {
    name: string
    image: string
}

export type Location = 'graveyard1' | 'deck1' | 'monster11' | 'monster12' | 'monster13' | 'power11' | 'power12' | 'banished1' | 'extra1' | 'monster14' | 'monster15' | 'monster16' | 'power13' | 'power14' | 'power21' | 'power22' | 'monster21' | 'monster22' | 'monster23' | 'extra2' | 'banished2' | 'power23' | 'power24' | 'monster24' | 'monster25' | 'monster26' | 'deck2' | 'graveyard2' | 'hand11' | 'hand12' | 'hand13' | 'hand14' | 'hand15' | 'hand16' | 'hand17' | 'hand21' | 'hand22' | 'hand23' | 'hand24' | 'hand25' | 'hand26' | 'hand27'

export const fieldLayout: Location[] = [
    'hand11',
    'hand12',
    'hand13',
    'hand14',
    'hand15',
    'hand16',
    'hand17',
    'graveyard1',
    'deck1',
    'monster11',
    'monster12',
    'monster13',
    'power11',
    'power12',
    'banished1',
    'extra1',
    'monster14',
    'monster15',
    'monster16',
    'power13',
    'power14',
    'power21',
    'power22',
    'monster21',
    'monster22',
    'monster23',
    'extra2',
    'banished2',
    'power23',
    'power24',
    'monster24',
    'monster25',
    'monster26',
    'deck2',
    'graveyard2',
    'hand21',
    'hand22',
    'hand23',
    'hand24',
    'hand25',
    'hand26',
    'hand27',
]

export const locations: Record<Location, { name: string, colour: string }> = {
    hand11: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand12: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand13: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand14: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand15: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand16: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand17: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    graveyard1: {
        name: 'Graveyard',
        colour: 'bg-gray-500',
    },
    deck1: {
        name: 'Deck',
        colour: 'bg-amber-900',
    },
    monster11: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    monster12: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    monster13: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    power11:   {
        name: 'Power',
        colour: 'bg-blue-600',
    },
    power12: {
        name: 'Power',
        colour: 'bg-blue-600',
    },
    banished1: {
        name: 'Banished',
        colour: 'bg-purple-700',
    },
    extra1: {
        name: 'Extra',
        colour: 'bg-green-700',
    },
    monster14: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    monster15: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    monster16:          {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    power13: {
        name: 'Power',
        colour: 'bg-blue-600',
    },
    power14: {
        name: 'Power',  
        colour: 'bg-blue-600',
    },
    extra2: {
        name: 'Extra',
        colour: 'bg-green-700',
    },
    banished2: {
        name: 'Banished',
        colour: 'bg-purple-700',
    },
    power21: {
        name: 'Power',
        colour: 'bg-blue-600',
    },
    power22: {
        name: 'Power',
        colour: 'bg-blue-600',
    },
    monster21: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    monster22: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    monster23: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    power23: {
        name: 'Power',
        colour: 'bg-blue-600',
    },
    power24: {
        name: 'Power',
        colour: 'bg-blue-600',
    },
    monster24: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    monster25: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    monster26: {
        name: 'Monster',
        colour: 'bg-yellow-800',
    },
    deck2: {
        name: 'Deck',
        colour: 'bg-amber-900',
    },
    graveyard2: {
        name: 'Graveyard',
        colour: 'bg-gray-500',
    },
    hand21: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand22: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand23: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand24: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand25: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand26: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
    hand27: {
        name: 'Hand',
        colour: 'bg-transparent',
    },
}