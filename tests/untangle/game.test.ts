import { expect, it } from 'vitest'
import { intersects, move, newGame, won } from '../../src/games/untangle/core/game'
it('detects crossings, overlaps and touching unrelated segments', () => {
  expect(intersects({x:0,y:0},{x:2,y:2},{x:0,y:2},{x:2,y:0})).toBe(true)
  expect(intersects({x:0,y:0},{x:2,y:0},{x:1,y:0},{x:3,y:0})).toBe(true)
  expect(intersects({x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1})).toBe(false)
})
it('starts tangled with a valid solution and keeps points inside the board', () => {
  for (const count of [5,6,7,8,9]) {
    const state = newGame(count, () => 0.5)
    expect(won(state)).toBe(false)
    expect(won({ ...state, points: state.target })).toBe(true)
    expect(move(state, 0, {x:-50,y:900}).points[0]).toEqual({x:70,y:745})
    expect(state.moves).toBe(0)
    expect(move(state, -1, {x:1,y:1})).toBe(state)
  }
})
