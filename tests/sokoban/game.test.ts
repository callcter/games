import { expect, it } from 'vitest'
import { LEVELS, move, newGame, solve } from '../../src/games/sokoban/core/game'
it('every supplied level is solvable through legal pushes', () => {
  LEVELS.forEach((_, level) => {
    let state = newGame(level)
    const path = solve(state)
    expect(path).not.toBeNull()
    for (const direction of path!) state = move(state, direction)
    expect(state.won).toBe(true)
    expect(move(state, 0)).toBe(state)
  })
})
it('does not push through a wall or a second box or mutate input', () => {
  const state = newGame()
  const blocked = { ...state, boxes: [17, 18], player: 16 }
  expect(move(blocked, 1)).toBe(blocked)
  expect(move({ ...state, player: 8 }, 0).player).toBe(8)
  expect(move(state, 1).boxes).not.toEqual(state.boxes)
  expect(state.moves).toBe(0)
  expect(move(state, 10)).toBe(state)
})
