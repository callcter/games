import { expect, it } from 'vitest'
import { dragAlong, move, newGame, path, undo } from '../../src/games/maze/core/game'
import { neighbor } from '../../src/games/pipes/core/game'
it('all sizes have a reproducible traversable route', () => {
  for (const size of [5, 7, 9, 11]) {
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
it('interpolates a fast finger drag through every corridor cell without crossing walls', () => {
  const state = { ...newGame(5), passages: Array<number>(25).fill(0) }
  state.passages[0] = 2; state.passages[1] = 10; state.passages[2] = 8
  const moved = dragAlong(state,0.5,0.5,4.5,0.5)
  expect(moved.player).toBe(2)
  expect(moved.trail).toEqual([0,1])
  expect(state.player).toBe(0)
  expect(undo(moved).player).toBe(1)
})
it('does not teleport on diagonal shortcuts, out-of-board input or drags starting away from the player', () => {
  const state = newGame(7,()=>0.4)
  expect(dragAlong(state,0.5,0.5,1.5,1.5)).toBe(state)
  expect(dragAlong(state,3.5,3.5,4.5,3.5)).toBe(state)
  expect(dragAlong(state,0.5,0.5,NaN,1)).toBe(state)
  expect(dragAlong(state,0.5,0.5,-1,0.5)).toBe(state)
  expect(dragAlong({...state,won:true},0.5,0.5,1.5,0.5).player).toBe(0)
})
