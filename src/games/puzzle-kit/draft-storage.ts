import { loadGameSave, saveGame } from '../../platform/storage/game-storage'

interface Envelope { version: 1; updated: number; value: unknown }
const cache = new Map<string, Envelope>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const writes = new Map<string, Promise<void>>()
const key = (id: string): string => `game-puzzle-draft-${id}-v1`
const valid = (value: unknown): value is Envelope => !!value && typeof value === 'object' && (value as Envelope).version === 1 && Number.isFinite((value as Envelope).updated)

export async function loadDraft<T>(id: string, restore: (value: unknown) => T | null): Promise<T | null> {
  if (cache.has(id)) return restore(cache.get(id)!.value)
  let backup: unknown
  try { backup = JSON.parse(localStorage.getItem(key(id)) ?? 'null') } catch { /* 隐私模式或损坏的应急备份 */ }
  const saved = await loadGameSave<unknown>(key(id))
  // 读取期间已有新操作时，不能用旧的磁盘结果覆盖它。
  const candidates = [cache.get(id), backup, saved].filter(valid).sort((a,b) => b.updated - a.updated)
  for (const candidate of candidates) {
    const restored = restore(candidate.value)
    if (restored) { cache.set(id, candidate); return restored }
  }
  return null
}

export function saveDraft(id: string, value: unknown): void {
  if (JSON.stringify(cache.get(id)?.value) === JSON.stringify(value)) return
  cache.set(id, { version: 1, updated: Math.max(Date.now(), (cache.get(id)?.updated ?? 0) + 1), value: structuredClone(value) })
  clearTimeout(timers.get(id))
  timers.set(id, setTimeout(() => flushDraft(id), 250))
}

export function flushDraft(id: string): void {
  clearTimeout(timers.get(id)); timers.delete(id)
  const saved = cache.get(id)
  if (!saved) return
  // pagehide 时 Safari 未必等异步事务完成；同步备份只存本地、下次按时间择新。
  try { localStorage.setItem(key(id), JSON.stringify(saved)) } catch { /* IndexedDB 仍可保存 */ }
  const snapshot = structuredClone(saved)
  writes.set(id, (writes.get(id) ?? Promise.resolve()).catch(() => undefined).then(() => saveGame(key(id), snapshot)))
}
