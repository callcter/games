import { expect, it } from 'vitest'
import { connected, newGame, rotate, turn, won } from '../../src/games/pipes/core/game'
it('generates solvable trees deterministically at every difficulty', () => {
  for (const size of [3, 4, 5]) {
    const state = newGame(size, () => 0.4)
    expect(state).toEqual(newGame(size, () => 0.4))
    expect(won({ ...state, cells: state.solution })).toBe(true)
    expect(state.solution.reduce((sum, mask) => sum + mask.toString(2).replaceAll('0', '').length, 0)).toBe(2 * (size * size - 1))
  }
})
it('rotates without mutation and does not connect through unmatched ends', () => {
  expect(rotate(9)).toBe(3)
  const state = { size: 3, cells: [2, 2, 8, 0, 0, 0, 0, 0, 0], solution: [], moves: 0 }
  expect([...connected(state)]).toEqual([0])
  expect(turn(state, 0).cells[0]).toBe(4)
  expect(state.cells[0]).toBe(2)
  expect(turn(state, -1)).toBe(state)
})
