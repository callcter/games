import { expect, it } from 'vitest'
import { clues, countSolutions, mark, newGame, PATTERNS, solution } from '../../src/games/nonogram/core/game'
it('all picture clues have one solution', () => {
  PATTERNS.forEach((_, index) => expect(countSolutions(solution(index))).toBe(1))
  expect(clues([0, 1, 1, 0, 1])).toEqual([2, 1])
  expect(clues([0, 0])).toEqual([0])
})
it('requires exactly the correct filled squares and ignores empty crosses', () => {
  const initial = newGame()
  expect(mark(initial, -1, 1)).toBe(initial)
  let state = initial
  solution(0).forEach((value, index) => { state = mark(state, index, value ? 1 : -1) })
  expect(state.won).toBe(true)
  expect(mark(state, 0, 1)).toBe(state)
  expect(initial.marks.every(value => value === 0)).toBe(true)
})
