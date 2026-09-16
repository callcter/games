import { describe, expect, it } from 'vitest'
import { createDeck, type Card } from '../../src/games/cards/core/cards'
import {
  maxMovableCards,
  microsoftDeal,
  moveFreeCellToTableau,
  moveTableauToFoundation,
  moveTableauToFreeCell,
  moveTableauToTableau,
  movableSequenceLength,
  newGame,
  newNumberedGame,
  randomGameNumber,
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

  it('moves a card or a valid sequence into an empty column', () => {
    const single = moveTableauToTableau(state([[card(5, 'clubs')]]), 0, 1)
    expect(single.moved).toBe(true)
    expect(single.state.tableau[1]?.map((item) => item.rank)).toEqual([5])

    const sequence = moveTableauToTableau(state([
      [card(8, 'clubs'), card(7, 'hearts'), card(6, 'spades')]
    ]), 0, 1, 3)
    expect(sequence.moved).toBe(true)
    expect(sequence.state.tableau[1]?.map((item) => item.rank)).toEqual([8, 7, 6])
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

  it('deals the classic microsoft game number 1 exactly', () => {
    const game = newNumberedGame(1)
    // 公开资料中微软 1 号局：第一列 J♦ K♦ 2♠ 4♣ 3♠ 6♦ 6♠
    expect(game.gameNumber).toBe(1)
    expect(game.tableau[0]?.map((item) => `${item.rank}${item.suit}`)).toEqual([
      '11diamonds', '13diamonds', '2spades', '4clubs', '3spades', '6diamonds', '6spades'
    ])
    // 第一行（各列首张）：J♦ 2♦ 9♥ J♣ 5♦ 7♥ 7♣ 5♥
    expect(game.tableau.map((column) => column[0]!).map((item) => `${item.rank}${item.suit}`)).toEqual([
      '11diamonds', '2diamonds', '9hearts', '11clubs', '5diamonds', '7hearts', '7clubs', '5hearts'
    ])
  })

  it('deals identically for the same game number', () => {
    expect(microsoftDeal(24)).toEqual(microsoftDeal(24))
    expect(microsoftDeal(32000)).toHaveLength(52)
    expect(new Set(microsoftDeal(799).map((item) => `${item.suit}-${item.rank}`)).size).toBe(52)
  })

  it('rejects game numbers outside the classic range', () => {
    expect(() => microsoftDeal(0)).toThrow()
    expect(() => microsoftDeal(32001)).toThrow()
    expect(() => microsoftDeal(1.5)).toThrow()
  })

  it('never picks the known unsolvable game when choosing randomly', () => {
    for (let step = 0; step <= 1000; step += 1) {
      expect(randomGameNumber(() => step / 1000)).not.toBe(11982)
    }
    expect(randomGameNumber(() => 0)).toBe(1)
    expect(randomGameNumber(() => 0.999999)).toBeLessThanOrEqual(32000)
  })

  it('keeps restoring saves from before game numbers existed', () => {
    const legacy = { ...newGame(() => 0.4), gameNumber: undefined }
    const restored = restoreGame(legacy)
    expect(restored?.gameNumber).toBe(0)
    expect(restored?.tableau).toEqual(legacy.tableau)
    expect(restoreGame({ ...legacy, gameNumber: 32001 })).toBeNull()
  })
})
