import type { MemoryState } from './core/game'

export interface MemoryVisualDelta {
  reveal: number[]
  conceal: number[]
  matched: number[]
}

export function memoryVisualDelta(
  previous: MemoryState,
  next: MemoryState
): MemoryVisualDelta {
  const wasShown = new Set([...previous.open, ...previous.matched])
  const isShown = new Set([...next.open, ...next.matched])
  const wasMatched = new Set(previous.matched)

  return {
    reveal: [...isShown].filter(index => !wasShown.has(index)),
    conceal: [...wasShown].filter(index => !isShown.has(index)),
    matched: next.matched.filter(index => !wasMatched.has(index))
  }
}
