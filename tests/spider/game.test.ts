import { describe, expect, it } from 'vitest'
import { createDeck, type Card } from '../../src/games/cards/core/cards'
import {
  dealStock,
  moveSequence,
  movableSequenceLength,
  newGame,
  restoreGame,
  type SpiderCard,
  type SpiderState
} from '../../src/games/spider/core/game'

const cards = createDeck(8, ['spades'])
const card = (rank: number, copy = 0): Card => cards.find((item) => item.rank === rank && item.id.startsWith(`${copy}-`))!
const up = (rank: number, copy = 0): SpiderCard => ({ card: card(rank, copy), faceUp: true })

function state(tableau: SpiderCard[][], stock: Card[] = []): SpiderState {
  return {
    suitCount: 1,
    tableau: [...tableau, ...Array.from({ length: 10 - tableau.length }, () => [])],
    stock,
    completedRuns: 0,
    moves: 0,
    score: 500,
    won: false
  }
}

describe('spider rules', () => {
  it('deals 54 cards and keeps 50 cards in stock', () => {
    const game = newGame(1, () => 0.5)
    expect(game.tableau.flat()).toHaveLength(54)
    expect(game.stock).toHaveLength(50)
    expect(game.tableau.map((column) => column.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5])
    expect(game.tableau.every((column) => column.filter((item) => item.faceUp).length === 1)).toBe(true)
  })

  it('only moves a face-up descending sequence', () => {
    expect(movableSequenceLength([up(8), up(7), up(6)], 0)).toBe(3)
    expect(movableSequenceLength([{ ...up(8), faceUp: false }, up(7)], 0)).toBe(0)
  })

  it('offers one, two, and four suit deals', () => {
    expect(new Set(newGame(1, () => 0.4).tableau.flat().map((item) => item.card.suit))).toEqual(new Set(['spades']))
    expect(new Set(newGame(2, () => 0.4).tableau.flat().map((item) => item.card.suit))).toEqual(new Set(['spades', 'hearts']))
    expect(new Set(newGame(4, () => 0.4).tableau.flat().map((item) => item.card.suit))).toEqual(new Set(['spades', 'hearts', 'clubs', 'diamonds']))
  })

  it('only moves same-suit descending sequences', () => {
    const heartSeven = createDeck().find((item) => item.rank === 7 && item.suit === 'hearts')!
    expect(movableSequenceLength([up(8), { card: heartSeven, faceUp: true }], 0)).toBe(0)
  })

  it('moves a sequence onto the next higher rank and flips the source', () => {
    const hidden = { ...up(4), faceUp: false }
    const game = state([[hidden, up(8), up(7)], [up(9)]])
    const result = moveSequence(game, 0, 1, 1)
    expect(result.moved).toBe(true)
    expect(result.state.tableau[0]?.at(-1)?.faceUp).toBe(true)
    expect(result.state.tableau[1]?.map((item) => item.card.rank)).toEqual([9, 8, 7])
  })

  it('does not deal stock while a column is empty', () => {
    const game = state([[up(2)]], cards.slice(0, 10))
    expect(dealStock(game).moved).toBe(false)
  })

  it('deals one face-up card to every non-empty column', () => {
    const tableau = Array.from({ length: 10 }, () => [up(2)])
    const result = dealStock(state(tableau, cards.slice(0, 10)))
    expect(result.moved).toBe(true)
    expect(result.state.stock).toHaveLength(0)
    expect(result.state.tableau.every((column) => column.length === 2 && column.at(-1)?.faceUp)).toBe(true)
  })

  it('removes a complete king-to-ace run', () => {
    const partialRun = Array.from({ length: 12 }, (_, index) => up(13 - index))
    const game = state([partialRun, [up(1)], ...Array.from({ length: 8 }, () => [up(5)])])
    const result = moveSequence(game, 1, 0, 0)
    expect(result.completed).toBe(1)
    expect(result.state.completedRuns).toBe(1)
    expect(result.state.tableau[0]).toEqual([])
  })

  it('restores valid saves and rejects incomplete decks', () => {
    const game = newGame(2, () => 0.4)
    expect(restoreGame(game)).toEqual(game)
    expect(restoreGame({ ...game, stock: game.stock.slice(1) })).toBeNull()
  })
})
