import type { RandomSource } from '../../cards/core/cards'

export const MODES: readonly { label: string; interval: number; speed: number; bomb: number; doubleChance: number }[] = [
  { label: '悠闲', interval: 1300, speed: 640, bomb: 0.08, doubleChance: 0.3 },
  { label: '标准', interval: 950, speed: 800, bomb: 0.12, doubleChance: 0.4 },
  { label: '挑战', interval: 720, speed: 960, bomb: 0.15, doubleChance: 0.5 }
]
const GRAVITY = 1350
export const FRUIT_RADIUS = 46
const FIELD = { left: 100, right: 668, launchY: 905 }
export const FRUITS = ['🍉', '🍓', '🍊', '🍏', '🍋', '🍇'] as const

export interface Fruit { x: number; y: number; vx: number; vy: number; kind: number; bomb: boolean }
export interface SliceState {
  mode: number
  fruits: Fruit[]
  score: number
  cut: number
  elapsedMs: number
  spawnIn: number
}

export function newGame(mode = 1, random: RandomSource = Math.random): SliceState {
  if (![0, 1, 2].includes(mode)) throw new Error('无效难度')
  return { mode, fruits: [], score: 0, cut: 0, elapsedMs: 0, spawnIn: 260 + value(random) * 400 }
}

const value = (random: RandomSource): number => {
  const raw = random()
  return Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0
}

/** 抛物线推进；落出底部的水果直接消失（休闲规则：漏接不惩罚）。 */
export function step(state: SliceState, deltaMs: number, random: RandomSource = Math.random): SliceState {
  if (!(deltaMs > 0)) return state
  const config = MODES[state.mode]!
  const seconds = deltaMs / 1000
  const fruits = state.fruits
    .map(fruit => ({ ...fruit, x: fruit.x + fruit.vx * seconds, y: fruit.y + fruit.vy * seconds, vy: fruit.vy + GRAVITY * seconds }))
    .filter(fruit => fruit.y < 980)
  let spawnIn = state.spawnIn - deltaMs
  const elapsedMs = state.elapsedMs + deltaMs
  if (spawnIn <= 0) {
    const count = value(random) < config.doubleChance ? 2 : 1
    for (let i = 0; i < count; i++) {
      const bomb = value(random) < config.bomb
      fruits.push({
        x: FIELD.left + value(random) * (FIELD.right - FIELD.left),
        y: FIELD.launchY,
        vx: (value(random) - 0.5) * 170,
        vy: -(config.speed + value(random) * 170),
        kind: Math.floor(value(random) * FRUITS.length),
        bomb
      })
    }
    spawnIn += config.interval * (0.75 + value(random) * 0.5)
  }
  return { ...state, fruits, elapsedMs, spawnIn }
}

/** 点到线段的最短距离，用于切割判定。 */
function segmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export interface SliceResult {
  state: SliceState
  /** 被切中的普通水果与炸弹，场景用来播放对应动画。 */
  cutFruits: Fruit[]
  bombs: number
  /** 一刀多果奖励分（3 个起 +3）。 */
  bonus: number
}

/** 用滑动线段切水果：命中的普通水果每个 1 分，一刀 3 个起 +3 奖励；炸弹计数由场景扣时。 */
export function slice(state: SliceState, x1: number, y1: number, x2: number, y2: number): SliceResult {
  const hits: number[] = []
  state.fruits.forEach((fruit, index) => {
    if (segmentDistance(fruit.x, fruit.y, x1, y1, x2, y2) <= FRUIT_RADIUS) hits.push(index)
  })
  if (!hits.length) return { state, cutFruits: [], bombs: 0, bonus: 0 }
  const cutFruits = hits.map(index => state.fruits[index]!)
  const bombs = cutFruits.filter(fruit => fruit.bomb).length
  const normals = cutFruits.length - bombs
  const bonus = normals >= 3 ? 3 : 0
  const remains = state.fruits.filter((_, index) => !hits.includes(index))
  return {
    state: { ...state, fruits: remains, score: state.score + normals + bonus, cut: state.cut + normals },
    cutFruits,
    bombs,
    bonus
  }
}
