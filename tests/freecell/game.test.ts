import { describe, expect, it } from 'vitest'
import { createDeck, type Card } from '../../src/games/cards/core/cards'
import {
  maxMovableCards,
  moveFreeCellToTableau,
  moveTableauToFoundation,
  moveTableauToFreeCell,
  moveTableauToTableau,
  movableSequenceLength,
  newGame,
  restoreGame,
  type FreeCellState
} from '../../src/games/freecell/core/game'

const card = (rank: number, suit: Card['suit']): Card => createDeck().find((item) => item.rank === rank && item.suit === suit)!

function state(tableau: Card[][]): FreeCellState {
  return {
    ...newGame(() => 0),
    tableau: [...tableau, ...Array.from({ length: 8 - tableau.length }, () => [])],
    freeCells: [null, null, null, null],
    foundations: { spades: 0, hearts: 0, clubs: 0, diamonds: 0 }
  }
}

describe('freecell rules', () => {
  it('deals all 52 cards into eight columns', () => {
    const game = newGame(() => 0.5)
    expect(game.tableau.flat()).toHaveLength(52)
    expect(game.tableau.map((column) => column.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6])
  })

  it('recognizes descending alternating sequences', () => {
    expect(movableSequenceLength([card(8, 'clubs'), card(7, 'hearts'), card(6, 'spades')], 0)).toBe(3)
    expect(movableSequenceLength([card(8, 'clubs'), card(7, 'spades')], 0)).toBe(0)
  })

  it('moves a valid sequence onto the opposite color', () => {
    const game = state([
      [card(8, 'clubs'), card(7, 'hearts'), card(6, 'spades')],
      [card(8, 'spades')]
    ])
    const result = moveTableauToTableau(game, 0, 1, 2)
    expect(result.moved).toBe(true)
    expect(result.state.tableau[1]?.map((item) => item.rank)).toEqual([8, 7, 6])
  })

  it('uses a free cell for one exposed card', () => {
    const game = state([[card(5, 'clubs')], [card(6, 'hearts')]])
    const stored = moveTableauToFreeCell(game, 0, 0)
    const restored = moveFreeCellToTableau(stored.state, 0, 1)
    expect(stored.state.freeCells[0]?.rank).toBe(5)
    expect(restored.state.freeCells[0]).toBeNull()
    expect(restored.state.tableau[1]?.at(-1)?.rank).toBe(5)
  })

  it('builds foundations from ace upward in the same suit', () => {
    const ace = moveTableauToFoundation(state([[card(1, 'spades')]]), 0)
    expect(ace.moved).toBe(true)
    expect(ace.state.foundations.spades).toBe(1)
    expect(moveTableauToFoundation(state([[card(2, 'spades')]]), 0).moved).toBe(false)
  })

  it('calculates multi-card capacity from free cells and empty columns', () => {
    const game = state([[card(8, 'clubs')], [card(9, 'hearts')]])
    expect(maxMovableCards(game, 1)).toBe(320)
  })

  it('restores a valid game and rejects malformed saves', () => {
    const state = newGame(() => 0.4)
    expect(restoreGame(state)).toEqual(state)
    expect(restoreGame({ ...state, tableau: state.tableau.slice(1) })).toBeNull()
    expect(restoreGame({ ...state, freeCells: [state.tableau[0]?.[0], null, null, null] })).toBeNull()
  })
})
