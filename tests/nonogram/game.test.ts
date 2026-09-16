import { expect, it } from 'vitest'
import { clues, countSolutions, mark, newGame, PATTERNS, solution } from '../../src/games/nonogram/core/game'
it('all picture clues have one solution', () => {
  PATTERNS.forEach((_, index) => expect(countSolutions(solution(index))).toBe(1))
  expect(clues([0, 1, 1, 0, 1])).toEqual([2, 1])
  expect(clues([0, 0])).toEqual([0])
})
it('supports the 10x10 challenge patterns', () => {
  const level = PATTERNS.findIndex(pattern => pattern.rows[0]!.length === 10)
  expect(level).toBeGreaterThanOrEqual(0)
  expect(solution(level)).toHaveLength(100)
  expect(newGame(level).marks).toHaveLength(100)
  expect(mark(newGame(level), 99, 1).marks[99]).toBe(1)
  expect(mark(newGame(level), 100, 1).won).toBe(false)
  expect(() => solution(PATTERNS.length)).toThrow('无效关卡')
  let state = newGame(level)
  solution(level).forEach((value, index) => { state = mark(state, index, value ? 1 : -1) })
  expect(state.won).toBe(true)
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
