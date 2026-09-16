import { describe, expect, it } from 'vitest'
import { conceal, flip, newGame } from '../../src/games/memory/core/game'

describe('memory', () => {
  it('rejects retired difficulties and deals pairs reproducibly', () => {
    expect(() => newGame(6, 1, () => 0.2)).toThrow('无效难度')
    const game = newGame(16, 1, () => 0.2)
    expect(game).toEqual(newGame(16, 1, () => 0.2))
    for (let i = 0; i < 16; i++) expect(game.cards.filter(c => c === i)).toHaveLength(2)
    expect(flip(game, -1)).toBe(game)
    const selected = flip(game, 0)
    expect(flip(selected, 0)).toBe(selected)
    expect(game.open).toEqual([])
  })
  it('supports the largest board with 24 distinct pairs', () => {
    const game = newGame(24, 2, () => 0.2)
    expect(game.cards).toHaveLength(48)
    expect(new Set(game.cards).size).toBe(24)
  })
  it('locks unmatched cards until concealed and changes player', () => {
    const game = { ...newGame(8, 2), cards: [0, 1, 0, 1, 2, 3, 2, 3, 4, 5, 4, 5, 6, 7, 6, 7] }
    const wrong = flip(flip(game, 0), 1)
    expect(flip(wrong, 2)).toBe(wrong)
    expect(conceal(wrong).player).toBe(1)
  })
  it('awards pairs, retains turn, and finishes', () => {
    let game = { ...newGame(8, 2), cards: [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7] }
    for (let i = 0; i < 8; i++) game = flip(flip(game, i), i + 8)
    expect(game.won).toBe(true)
    expect(game.scores).toEqual([8, 0])
    expect(flip(game, 0)).toBe(game)
  })
})
