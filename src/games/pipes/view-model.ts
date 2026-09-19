import { rotate } from './core/game'

/**
 * 从当前 mask 到目标 mask 的最短视觉旋转。
 * 正数顺时针，负数逆时针；2 表示 180°。
 */
export function pipeQuarterTurnDelta(from: number, to: number): -1 | 0 | 1 | 2 {
  if (from === to) return 0
  let value = from
  for (let step = 1; step <= 3; step++) {
    value = rotate(value)
    if (value !== to) continue
    if (step === 3) return -1
    return step as 1 | 2
  }
  return 0
}
