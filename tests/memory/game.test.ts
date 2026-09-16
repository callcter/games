import { describe, expect, it } from 'vitest'
import { conceal, flip, newGame } from '../../src/games/memory/core/game'

describe('memory', () => {
  it('deals pairs reproducibly without mutating on invalid flips', () => {
    const game = newGame(6, 1, () => 0.2)
    expect(game).toEqual(newGame(6, 1, () => 0.2))
    for (let i = 0; i < 6; i++) expect(game.cards.filter(c => c === i)).toHaveLength(2)
    expect(flip(game, -1)).toBe(game)
    const selected = flip(game, 0)
    expect(flip(selected, 0)).toBe(selected)
    expect(game.open).toEqual([])
  })
  it('locks unmatched cards until concealed and changes player', () => {
    const game = { ...newGame(3, 2), cards: [0, 1, 2, 0, 1, 2] }
    const wrong = flip(flip(game, 0), 1)
    expect(flip(wrong, 2)).toBe(wrong)
    expect(conceal(wrong).player).toBe(1)
  })
  it('awards pairs, retains turn, and finishes', () => {
    let game = { ...newGame(3, 2), cards: [0, 1, 2, 0, 1, 2] }
    for (let i = 0; i < 3; i++) game = flip(flip(game, i), i + 3)
    expect(game.won).toBe(true)
    expect(game.scores).toEqual([3, 0])
    expect(flip(game, 0)).toBe(game)
  })
})
