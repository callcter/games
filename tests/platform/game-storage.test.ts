import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadGameSave, saveGame, withTimeout } from '../../src/platform/storage/game-storage'

describe('game storage timeout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resolves with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50, '超时')).resolves.toBe('ok')
  })

  it('rejects with the timeout message when the promise hangs', async () => {
    const hanging = new Promise<string>(() => {})
    await expect(withTimeout(hanging, 10, '测试超时')).rejects.toThrow('测试超时')
  })

  it('returns null instead of hanging when opening the database never calls back', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => ({})
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(loadGameSave('game-2048-v1', 10)).resolves.toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('returns null instead of hanging when the read transaction never calls back', async () => {
    const store = { get: () => ({}) }
    const database = {
      transaction: () => ({
        objectStore: () => store
      }),
      close: () => {}
    }
    vi.stubGlobal('indexedDB', {
      open: () => ({
        set onsuccess(callback: () => void) { callback() },
        get result() { return database }
      })
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(loadGameSave('game-2048-v1', 10)).resolves.toBeNull()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('swallows save failures instead of throwing', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => ({})
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(saveGame('game-2048-v1', { a: 1 }, 10)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
