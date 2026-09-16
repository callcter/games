import type { RandomSource } from '../../cards/core/cards'

export const MODES: readonly { label: string; interval: number; speed: number; cracker: number }[] = [
  { label: '悠闲', interval: 820, speed: 150, cracker: 0.06 },
  { label: '标准', interval: 600, speed: 215, cracker: 0.1 },
  { label: '挑战', interval: 470, speed: 285, cracker: 0.14 }
]
const FIELD = { top: 218, bottom: 852, left: 84, right: 684 }
const COMBO_WINDOW_MS = 800

export interface Drop { x: number; y: number; cracker: boolean }
export interface RedState {
  mode: number
  drops: Drop[]
  score: number
  opened: number
  combo: number
  lastOpenMs: number
  elapsedMs: number
  spawnIn: number
}

export function newGame(mode = 1, random: RandomSource = Math.random): RedState {
  if (![0, 1, 2].includes(mode)) throw new Error('无效难度')
  return { mode, drops: [], score: 0, opened: 0, combo: 0, lastOpenMs: -COMBO_WINDOW_MS * 2, elapsedMs: 0, spawnIn: MODES[mode]!.interval * (0.4 + value(random) * 0.4) }
}

const value = (random: RandomSource): number => {
  const raw = random()
  return Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0
}

/** 连击倍数：连击 3 起两倍、6 起三倍封顶。 */
export function comboFactor(combo: number): number {
  return combo >= 6 ? 3 : combo >= 3 ? 2 : 1
}

/** 推进一个时间片：红包下落、落出底部回收（不惩罚），按节奏生成。 */
export function step(state: RedState, deltaMs: number, random: RandomSource = Math.random): RedState {
  if (!(deltaMs > 0)) return state
  const config = MODES[state.mode]!
  const seconds = deltaMs / 1000
  const drops = state.drops.map(drop => ({ ...drop, y: drop.y + config.speed * seconds })).filter(drop => drop.y < FIELD.bottom + 40)
  let spawnIn = state.spawnIn - deltaMs
  const elapsedMs = state.elapsedMs + deltaMs
  if (spawnIn <= 0) {
    drops.push({ x: FIELD.left + value(random) * (FIELD.right - FIELD.left), y: FIELD.top - 30, cracker: value(random) < config.cracker })
    spawnIn += config.interval * (0.72 + value(random) * 0.56)
  }
  return { ...state, drops, elapsedMs, spawnIn }
}

export interface TapResult { state: RedState; kind: 'red' | 'cracker' | 'none' }

/** 点按判定：触控宽容半径 52px，优先最靠近指尖的一个。 */
export function tap(state: RedState, x: number, y: number): TapResult {
  let index = -1, distance = Infinity
  state.drops.forEach((drop, i) => {
    const current = Math.hypot(drop.x - x, drop.y - y)
    if (current <= 52 && current < distance) { index = i; distance = current }
  })
  if (index < 0) return { state, kind: 'none' }
  const drop = state.drops[index]!
  if (drop.cracker) {
    // 炮仗：扣 3 分并清空连击，但不倒扣成负数。
    return { state: { ...state, drops: state.drops.filter((_, i) => i !== index), score: Math.max(0, state.score - 3), combo: 0 }, kind: 'cracker' }
  }
  const inWindow = state.elapsedMs - state.lastOpenMs <= COMBO_WINDOW_MS
  const combo = inWindow ? state.combo + 1 : 1
  return {
    state: { ...state, drops: state.drops.filter((_, i) => i !== index), combo, lastOpenMs: state.elapsedMs, score: state.score + comboFactor(combo), opened: state.opened + 1 },
    kind: 'red'
  }
}
