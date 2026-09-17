import { expect, it } from 'vitest'
import { clues, countSolutions, lineCells, mark, newGame, PATTERNS, solution } from '../../src/games/nonogram/core/game'
it('all picture clues have one solution', () => {
  PATTERNS.forEach((_, index) => expect(countSolutions(solution(index))).toBe(1))
  expect(clues([0, 1, 1, 0, 1])).toEqual([2, 1])
  expect(clues([0, 0])).toEqual([0])
})
it('expands to 30+ distinct pictures keeping original identities stable', () => {
  // Wave 4 内容扩展：变体去重；原图 0-8 保持旧索引（旧存档/完成记录兼容）；
  // 变体段内 5×5 变体先于 10×10 变体，形成先易后难的追加梯度。
  expect(PATTERNS.length).toBeGreaterThanOrEqual(30)
  const keys = new Set(PATTERNS.map(pattern => pattern.rows.join('/')))
  expect(keys.size).toBe(PATTERNS.length)
  const base = PATTERNS.slice(0, 9)
  expect(base.map(pattern => pattern.name)).toEqual(['小爱心', '小房子', '小树', '小十字', '小花', '大爱心', '小猫咪', '小帆船', '小火箭'])
  expect(base.map(pattern => pattern.rows[0]!.length)).toEqual([5, 5, 5, 5, 5, 10, 10, 10, 10])
  const variantSizes = PATTERNS.slice(9).map(pattern => pattern.rows[0]!.length)
  expect([...variantSizes].sort((a, b) => a - b)).toEqual(variantSizes)
})
it('restores pre-expansion drafts at their original picture identity', async () => {
  // 扩容前的真实存档（v1 键、level=5 是 10×10 大爱心）必须原样恢复。
  const { restoreNonogram } = await import('../../src/games/puzzle-kit/core/drafts')
  const legacy = { state: { level: 5, marks: Array<number>(100).fill(0), won: false }, history: [], assisted: false }
  const restored = restoreNonogram(legacy)
  expect(restored?.state.level).toBe(5)
  expect(restored?.state.marks).toHaveLength(100)
  expect(PATTERNS[5]!.name).toBe('大爱心')
  expect(solution(5)).toHaveLength(100)
  const legacy8 = { state: { level: 8, marks: Array<number>(100).fill(0), won: false }, history: [], assisted: false }
  expect(restoreNonogram(legacy8)?.state.level).toBe(8)
  const badSize = { state: { level: 5, marks: Array<number>(25).fill(0), won: false }, history: [], assisted: false }
  expect(restoreNonogram(badSize)).toBeNull()
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
