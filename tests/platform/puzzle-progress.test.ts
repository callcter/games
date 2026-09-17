import { beforeEach, expect, it, vi } from 'vitest'
const storage = vi.hoisted(() => ({ loadGameSave: vi.fn(), saveGame: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../src/platform/storage/game-storage', () => storage)
beforeEach(() => { vi.resetModules(); storage.loadGameSave.mockReset(); storage.saveGame.mockClear() })
it('sanitizes legacy or corrupt records without losing valid scores', async () => {
  storage.loadGameSave.mockResolvedValue({ best: { good: 4, bad: '2', negative: -1, infinite: Infinity }, flags: ['sudoku-4', 9, null, 'sudoku-4'], levels: { sokoban: 3, bad: -1, fractional: 2.2 } })
  const { loadProgress, summarizeProgress } = await import('../../src/games/puzzle-kit/progress')
  const progress = await loadProgress()
  expect(progress).toEqual({ best: { good: 4 }, flags: ['sudoku-4'], levels: { sokoban: 3 } })
  expect(summarizeProgress(progress).sudoku).toContain('难度')
})
it('shares reads, rejects invalid writes and persists independent snapshots in order', async () => {
  storage.loadGameSave.mockResolvedValue(null)
  const { loadProgress, recordBest, recordLevel, recordFlag } = await import('../../src/games/puzzle-kit/progress')
  await Promise.all([loadProgress(), loadProgress()])
  expect(storage.loadGameSave).toHaveBeenCalledTimes(1)
  recordBest('a', -1); recordLevel('a', 1.5)
  recordBest('a', 8); recordBest('a', 4); recordBest('a', 6); recordFlag('done')
  await vi.waitFor(() => expect(storage.saveGame).toHaveBeenCalledTimes(3))
  const values = storage.saveGame.mock.calls.map(call => call[1])
  expect(values[0].best.a).toBe(8)
  expect(values.at(-1)).toEqual({ best: { a: 4 }, flags: ['done'], levels: {} })
})
it('recovers from unavailable storage', async () => {
  storage.loadGameSave.mockRejectedValue(new Error('unavailable'))
  const { loadProgress } = await import('../../src/games/puzzle-kit/progress')
  expect(await loadProgress()).toEqual({ best: {}, flags: [], levels: {} })
})
it('keeps assisted runs separate and summarizes modes without double counting', async () => {
  storage.loadGameSave.mockResolvedValue(null)
  const { recordRun, loadProgress, summarizeProgress } = await import('../../src/games/puzzle-kit/progress')
  recordRun('pipes-3', 20, false); recordRun('pipes-3', 1, true)
  recordRun('sokoban-L0', 2, false); recordRun('sokoban-L0', 2, true)
  await vi.waitFor(() => expect(storage.saveGame).toHaveBeenCalledTimes(4))
  const progress = await loadProgress()
  expect(progress.best['pipes-3:solo']).toBe(20)
  expect(summarizeProgress(progress).pipes).toContain('20步 · 独立')
  expect(summarizeProgress(progress).sokoban).toBe('已过 1 关')
})
it('counts sokoban levels beyond the old 10-level cap and filters invalid keys', async () => {
  // Wave 4 扩到 30 关后的 stabilization：>10 关必须计入，越界/非法 key 不计。
  const { summarizeProgress } = await import('../../src/games/puzzle-kit/progress')
  const summary = summarizeProgress({
    best: { 'sokoban-L0': 2, 'sokoban-L9': 4, 'sokoban-L10': 6, 'sokoban-L11': 8, 'sokoban-L29': 12, 'sokoban-L30': 3, 'sokoban-L99': 1, 'sokoban-Lx': 1, 'sokoban-nope': 1 },
    flags: [], levels: {}
  })
  expect(summary.sokoban).toBe('已过 5 关')   // L0/L9/L10/L11/L29
})
it('shows the nonogram total from the live pattern library, not the old 9', async () => {
  const { summarizeProgress } = await import('../../src/games/puzzle-kit/progress')
  const { PATTERNS } = await import('../../src/games/nonogram/core/game')
  expect(PATTERNS.length).toBeGreaterThanOrEqual(30)
  const line = (count: number): string | undefined => summarizeProgress({ best: {}, flags: Array.from({ length: count }, (_, i) => `nonogram-${i}`), levels: {} }).nonogram
  expect(line(0)).toBeUndefined()
  expect(line(1)).toBe(`已画 1 / ${PATTERNS.length} 幅`)
  expect(line(17)).toBe(`已画 17 / ${PATTERNS.length} 幅`)
  expect(line(PATTERNS.length)).toBe(`已画 ${PATTERNS.length} / ${PATTERNS.length} 幅`)
})
it('renames numbered flags once for numbering migrations without double counting', async () => {
  storage.loadGameSave.mockResolvedValue({ best: {}, flags: ['nonogram-17', 'nonogram-2', 'nonogram-33', 'sudoku-4'], levels: {} })
  const { loadProgress, migrateNumberedFlags } = await import('../../src/games/puzzle-kit/progress')
  await loadProgress()
  // 只迁移 ≥9 的编号；0-8 两代同义保留；映射目标已存在时删旧防重复。
  migrateNumberedFlags('nonogram', 9, n => (n === 17 ? 9 : n === 33 ? 9 : undefined))
  await vi.waitFor(() => expect(storage.saveGame).toHaveBeenCalled())
  const saved = storage.saveGame.mock.calls.at(-1)![1]
  expect(saved.flags).toContain('nonogram-9')
  expect(saved.flags).not.toContain('nonogram-17')
  expect(saved.flags).not.toContain('nonogram-33')
  expect(saved.flags).toContain('nonogram-2')
  expect(saved.flags).toContain('sudoku-4')
})
it('labels old action records and separates the new difficulty tiers', async () => {
  const { summarizeProgress } = await import('../../src/games/puzzle-kit/progress')
  expect(summarizeProgress({best:{'pop-bubbles':999},flags:[],levels:{}})['pop-bubbles']).toContain('历史')
  expect(summarizeProgress({best:{'pop-bubbles':999,'pop-bubbles:v2:1':40},flags:[],levels:{}})['pop-bubbles']).toBe('进阶最高 40 分')
})
