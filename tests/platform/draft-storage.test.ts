import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const storage = vi.hoisted(() => ({ loadGameSave: vi.fn(), saveGame: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../src/platform/storage/game-storage', () => storage)
const restore = (v: unknown): { moves: number } | null => v && typeof v === 'object' && typeof (v as { moves?: number }).moves === 'number' ? v as { moves: number } : null
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); storage.loadGameSave.mockReset(); storage.saveGame.mockClear()
  const values = new Map<string,string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string,v: string) => values.set(k,v) })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('coalesces rapid actions, clones input and flushes a synchronous backup', async () => {
  const { saveDraft, flushDraft, loadDraft } = await import('../../src/games/puzzle-kit/draft-storage')
  const state = { moves: 1 }
  saveDraft('test', state); state.moves = 9
  expect(await loadDraft('test', restore)).toEqual({ moves: 1 })
  saveDraft('test', { moves: 2 }); saveDraft('test', { moves: 3 })
  await vi.advanceTimersByTimeAsync(250)
  expect(storage.saveGame).toHaveBeenCalledTimes(1)
  flushDraft('test')
  expect(JSON.parse(localStorage.getItem('game-puzzle-draft-test-v1')!).value.moves).toBe(3)
})
it('chooses a newer valid emergency copy and tolerates malformed copies', async () => {
  localStorage.setItem('game-puzzle-draft-test-v1', JSON.stringify({ version: 1, updated: 20, value: { moves: 4 } }))
  storage.loadGameSave.mockResolvedValue({ version: 1, updated: 10, value: { moves: 1 } })
  const { loadDraft } = await import('../../src/games/puzzle-kit/draft-storage')
  expect(await loadDraft('test', restore)).toEqual({ moves: 4 })
  localStorage.setItem('game-puzzle-draft-other-v1', '{')
  storage.loadGameSave.mockResolvedValue({ version: 99, updated: 50, value: {} })
  expect(await loadDraft('other', restore)).toBeNull()
})
it('does not replace a new in-memory move with a delayed disk result', async () => {
  let resolve!: (value: unknown) => void
  storage.loadGameSave.mockReturnValue(new Promise(r => { resolve = r }))
  const { loadDraft, saveDraft } = await import('../../src/games/puzzle-kit/draft-storage')
  const loading = loadDraft('test', restore)
  saveDraft('test', { moves: 8 })
  resolve({ version: 1, updated: 1, value: { moves: 1 } })
  expect(await loading).toEqual({ moves: 8 })
})
