import { expect, it } from 'vitest'
import { move, newGame, path, undo } from '../../src/games/maze/core/game'
import { neighbor } from '../../src/games/pipes/core/game'
it('all sizes have a reproducible traversable route', () => {
  for (const size of [5, 7, 9]) {
    let state = newGame(size, () => 0.3)
    expect(state).toEqual(newGame(size, () => 0.3))
    const route = path(state)
    expect(route.length).toBeGreaterThan(1)
    for (const next of route.slice(1)) state = move(state, [0, 1, 2, 3].find(d => neighbor(state.player, d, size) === next)!)
    expect(state.won).toBe(true)
    expect(move(state, 0)).toBe(state)
    expect(undo(state).won).toBe(false)
  }
})
it('walls and invalid directions leave state unchanged', () => {
  const state = newGame()
  expect(move(state, 0)).toBe(state)
  expect(move(state, 9)).toBe(state)
  expect(undo(state)).toBe(state)
})
