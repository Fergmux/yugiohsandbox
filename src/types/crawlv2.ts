export interface Card {
    name: string
    image: string
}

export type ZoneType = 'hand' | 'power' | 'unit' | 'leader' | 'trap' | 'empty' | 'deck' | 'spent' | 'dead'

export const locations: Record<string, { type: ZoneType, name: string | null}> = {
    // Row 1
    hand11: {
        type: 'hand',
        name: 'Hand',
    },
    hand12: {
        type: 'hand',
        name: 'Hand',
    },
    hand13: {
        type: 'hand',
        name: 'Hand',
    },
    hand14: {
        type: 'hand',
        name: 'Hand',
    },
    hand15: {
        type: 'hand',
        name: 'Hand',
    },
    hand16: {
        type: 'hand',
        name: 'Hand',
    },
    hand17: {
        type: 'hand',
        name: 'Hand',
    },

    // Row 2
    empty11: {
        type: 'empty',
        name: null,
    },
    empty12: {
        type: 'empty',
        name: null,
    },
    trap11: {
        type: 'trap',
        name: 'Trap',
    },
    trap12: {
        type: 'trap',
        name: 'Trap',
    },
    trap13: {
        type: 'trap',
        name: 'Trap',
    },
    empty13: {
        type: 'empty',
        name: null,
    },
    empty14: {
        type: 'empty',
        name: null,
    },

    // Row 3
    banished1: {
        type: 'dead',
        name: 'Dead',
    },
    graveyard1: {
        type: 'spent',
        name: 'Spent',
    },
    unit11: {
        type: 'unit',
        name: 'Unit',
    },
    unit12: {
        type: 'unit',
        name: 'Unit',
    },
    unit13: {
        type: 'unit',
        name: 'Unit',
    },
    deck1: {
        type: 'deck',
        name: 'Deck',
    },
    leader1: {
        type: 'leader',
        name: 'Leader',
    },

    // Row 4
    power11: {
        type: 'power',
        name: 'Power',
    },
    power12: {
        type: 'power',
        name: 'Power',
    },
    unit14: {
        type: 'unit',
        name: 'Unit',
    },
    unit15: {
        type: 'unit',
        name: 'Unit',
    },
    unit16: {
        type: 'unit',
        name: 'Unit',
    },
    power13: {
        type: 'power',
        name: 'Power',
    },
    power14: {
        type: 'power',
        name: 'Power',
    },

    // Row 2
    empty1: {
        type: 'empty',
        name: null,
    },
    empty2: {
        type: 'empty',
        name: null,
    },
    empty3: {
        type: 'empty',
        name: null,
    },
    empty4: {
        type: 'empty',
        name: null,
    },
    empty5: {
        type: 'empty',
        name: null,
    },
    empty6: {
        type: 'empty',
        name: null,
    },
    empty7: {
        type: 'empty',
        name: null,
    },

    // Row 5
    power21: {
        type: 'power',
        name: 'Power',
    },
    power22: {
        type: 'power',
        name: 'Power',
    },
    unit21: {
        type: 'unit',
        name: 'Unit',
    },
    unit22: {
        type: 'unit',
        name: 'Unit',
    },
    unit23: {
        type: 'unit',
        name: 'Unit',
    },
    power23: {
        type: 'power',
        name: 'Power',
    },
    power24: {
        type: 'power',
        name: 'Power',
    },

    // Row 6
    leader2: {
        type: 'leader',
        name: 'Leader',
    },
    deck2: {
        type: 'deck',
        name: 'Deck',
    },
    unit24: {
        type: 'unit',
        name: 'Unit',
    },
    unit25: {
        type: 'unit',
        name: 'Unit',
    },
    unit26: {
        type: 'unit',
        name: 'Unit',
    },
    graveyard2: {
        type: 'spent',
        name: 'Spent',
    },
    banished2: {
        type: 'dead',
        name: 'Dead',
    },

    //Row7
    empty21: {
        type: 'empty',
        name: null,
    },
    empty22: {
        type: 'empty',
        name: null,
    },
    trap21: {
        type: 'trap',
        name: 'Trap',
    },
    trap22: {
        type: 'trap',
        name: 'Trap',
    },
    trap23: {
        type: 'trap',
        name: 'Trap',
    },
    empty23: {
        type: 'empty',
        name: null,
    },
    empty24: {
        type: 'empty',
        name: null,
    },

    // Row 8
    hand21: {
        type: 'hand',
        name: 'Hand',
    },
    hand22: {
        type: 'hand',
        name: 'Hand',
    },
    hand23: {
        type: 'hand',
        name: 'Hand',
    },
    hand24: {
        type: 'hand',
        name: 'Hand',
    },
    hand25: {
        type: 'hand',
        name: 'Hand',
    },
    hand26: {
        type: 'hand',
        name: 'Hand',
    },
    hand27: {
        type: 'hand',
        name: 'Hand',
    },
}

export type Location = keyof typeof locations

export const fieldLayout: Location[] = Object.keys(locations) as Location[]