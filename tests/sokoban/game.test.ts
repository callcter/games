import { expect, it } from 'vitest'
import { LEVELS, move, newGame, PAR, solve, stars } from '../../src/games/sokoban/core/game'
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
it('keeps PAR in sync with the optimal solution length', () => {
  expect(LEVELS).toHaveLength(30) // Wave 4 内容扩展：10 → 30 关
  expect(PAR).toHaveLength(LEVELS.length)
  LEVELS.forEach((_, level) => expect(PAR[level]).toBe(solve(newGame(level))?.length))
})
it('awards stars by closeness to the optimal move count', () => {
  expect(stars(0, PAR[0])).toBe(3)
  expect(stars(0, PAR[0]! + 1)).toBeLessThanOrEqual(2)
  expect(stars(0, PAR[0]! * 3)).toBe(1)
  expect(stars(0, 0)).toBe(3)
  expect(stars(LEVELS.length, 10)).toBe(0)
  expect(stars(0, Number.NaN)).toBe(0)
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
