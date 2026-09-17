import { expect, it } from 'vitest'
import { clues, countSolutions, lineCells, mark, newGame, PATTERNS, solution } from '../../src/games/nonogram/core/game'
it('all picture clues have one solution', () => {
  PATTERNS.forEach((_, index) => expect(countSolutions(solution(index))).toBe(1))
  expect(clues([0, 1, 1, 0, 1])).toEqual([2, 1])
  expect(clues([0, 0])).toEqual([0])
})
it('expands to 30+ distinct pictures with natural size ordering', () => {
  // Wave 4 内容扩展：镜像变体 + 无重复 + 5×5 在前、10×10 在后的难度梯度。
  expect(PATTERNS.length).toBeGreaterThanOrEqual(30)
  const keys = new Set(PATTERNS.map(pattern => pattern.rows.join('/')))
  expect(keys.size).toBe(PATTERNS.length)
  const sizes = PATTERNS.map(pattern => pattern.rows[0]!.length)
  expect([...sizes].sort((a, b) => a - b)).toEqual(sizes)
})
it('fills skipped cells during a stroke in either direction without wrapping rows', () => {
  expect(lineCells(0, 4, 5)).toEqual([0,1,2,3,4])
  expect(lineCells(24, 4, 5)).toEqual([24,19,14,9,4])
  expect(lineCells(0, 24, 5)).toEqual([0,6,12,18,24])
  expect(lineCells(-1, 4, 5)).toEqual([])
  const state = newGame()
  expect(mark(state, 0, 0)).toBe(state)
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
