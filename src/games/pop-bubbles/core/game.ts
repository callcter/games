import type { RandomSource } from '../../cards/core/cards'

export const MODES: readonly { label: string; interval: number; speed: number; grow: number; startRadius: number; golden: number }[] = [
  { label: '悠闲', interval: 760, speed: 58, grow: 8, startRadius: 26, golden: 0.08 },
  { label: '标准', interval: 520, speed: 88, grow: 13, startRadius: 22, golden: 0.1 },
  { label: '挑战', interval: 380, speed: 125, grow: 18, startRadius: 18, golden: 0.12 }
]
const FIELD = { top: 228, bottom: 880, left: 80, right: 688 }
const MAX_RADIUS = 50

export interface Bubble { x: number; y: number; radius: number; golden: boolean }
export interface PopState {
  mode: number
  bubbles: Bubble[]
  score: number
  popped: number
  elapsedMs: number
  spawnIn: number
}

export function newGame(mode = 1, random: RandomSource = Math.random): PopState {
  if (![0, 1, 2].includes(mode)) throw new Error('无效难度')
  return { mode, bubbles: [], score: 0, popped: 0, elapsedMs: 0, spawnIn: MODES[mode]!.interval * (0.4 + value(random) * 0.4) }
}

const value = (random: RandomSource): number => {
  const raw = random()
  return Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0
}

/** 推进一个时间片：上升、变大、到顶回收，并按节奏生成新泡泡。 */
export function step(state: PopState, deltaMs: number, random: RandomSource = Math.random): PopState {
  if (!(deltaMs > 0)) return state
  const config = MODES[state.mode]!
  const seconds = deltaMs / 1000
  const bubbles: Bubble[] = []
  for (const bubble of state.bubbles) {
    const radius = Math.min(MAX_RADIUS, bubble.radius + config.grow * seconds)
    const y = bubble.y - config.speed * seconds
    if (y + radius > FIELD.top) bubbles.push({ ...bubble, y, radius })
  }
  let spawnIn = state.spawnIn - deltaMs
  let elapsedMs = state.elapsedMs + deltaMs
  if (spawnIn <= 0) {
    const golden = value(random) < config.golden
    bubbles.push({ x: FIELD.left + value(random) * (FIELD.right - FIELD.left), y: FIELD.bottom, radius: golden ? Math.max(20, config.startRadius - 4) : config.startRadius, golden })
    spawnIn += config.interval * (0.72 + value(random) * 0.56)
  }
  return { ...state, bubbles, elapsedMs, spawnIn }
}

/** 命中检测：容差 8px 的触控宽容；重叠时优先最小（最难点的）泡泡。 */
export function hitTest(state: PopState, x: number, y: number): number {
  let best = -1, bestRadius = Infinity
  state.bubbles.forEach((bubble, index) => {
    if (Math.hypot(bubble.x - x, bubble.y - y) <= bubble.radius + 8 && bubble.radius < bestRadius) {
      best = index
      bestRadius = bubble.radius
    }
  })
  return best
}

/** 泡泡越小分越高（越难点中），金色泡泡三倍；非法索引原样返回。 */
export function pop(state: PopState, index: number): PopState {
  const bubble = state.bubbles[index]
  if (!bubble) return state
  const base = bubble.radius <= 26 ? 3 : bubble.radius <= 36 ? 2 : 1
  const gained = bubble.golden ? base * 3 : base
  return { ...state, bubbles: state.bubbles.filter((_, i) => i !== index), score: state.score + gained, popped: state.popped + 1 }
}
