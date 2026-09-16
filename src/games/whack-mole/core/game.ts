import type { RandomSource } from '../../cards/core/cards'

export const MODES: readonly { label: string; stayMs: number; popInterval: number; sleeper: number }[] = [
  { label: '悠闲', stayMs: 2000, popInterval: 1250, sleeper: 0.12 },
  { label: '标准', stayMs: 1400, popInterval: 950, sleeper: 0.18 },
  { label: '挑战', stayMs: 900, popInterval: 700, sleeper: 0.22 }
]
export const HOLE_COUNT = 9
const COMBO_WINDOW_MS = 700

export interface Mole { upAt: number; sleeper: boolean }
export interface MoleState {
  mode: number
  holes: (Mole | null)[]
  score: number
  hits: number
  sleeperHits: number
  misses: number
  combo: number
  lastHitMs: number
  elapsedMs: number
  nextPopIn: number
}

export function newGame(mode = 1, random: RandomSource = Math.random): MoleState {
  if (![0, 1, 2].includes(mode)) throw new Error('无效难度')
  return {
    mode,
    holes: Array<Mole | null>(HOLE_COUNT).fill(null),
    score: 0, hits: 0, sleeperHits: 0, misses: 0, combo: 0, lastHitMs: -COMBO_WINDOW_MS * 2,
    elapsedMs: 0,
    nextPopIn: MODES[mode]!.popInterval * (0.5 + value(random) * 0.5)
  }
}

const value = (random: RandomSource): number => {
  const raw = random()
  return Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0
}

/** 连击倍数：连续命中 4 起两倍、8 起三倍封顶。 */
export function comboFactor(combo: number): number {
  return combo >= 8 ? 3 : combo >= 4 ? 2 : 1
}

/** 推进一个时间片：到时的地鼠缩回，按节奏往空穴放新地鼠。 */
export function step(state: MoleState, deltaMs: number, random: RandomSource = Math.random): MoleState {
  if (!(deltaMs > 0)) return state
  const config = MODES[state.mode]!
  const elapsedMs = state.elapsedMs + deltaMs
  const holes = state.holes.map(mole => mole && elapsedMs - mole.upAt <= config.stayMs ? mole : null)
  let nextPopIn = state.nextPopIn - deltaMs
  if (nextPopIn <= 0) {
    const free = holes.map((mole, index) => mole ? -1 : index).filter(index => index >= 0)
    if (free.length) {
      const hole = free[Math.floor(value(random) * free.length)]!
      holes[hole] = { upAt: elapsedMs, sleeper: value(random) < config.sleeper }
    }
    nextPopIn += config.popInterval * (0.75 + value(random) * 0.5)
  }
  return { ...state, holes, elapsedMs, nextPopIn }
}

export interface WhackResult { state: MoleState; kind: 'hit' | 'sleeper' | 'miss' }

/** 锤击判定：普通地鼠按连击倍数得分；睡着的鼠宝宝扣分；打空断连击。 */
export function whack(state: MoleState, hole: number): WhackResult {
  if (!Number.isInteger(hole) || hole < 0 || hole >= HOLE_COUNT) return { state, kind: 'miss' }
  const mole = state.holes[hole]
  if (!mole) {
    return { state: { ...state, misses: state.misses + 1, combo: 0 }, kind: 'miss' }
  }
  if (mole.sleeper) {
    return { state: { ...state, holes: state.holes.map((item, index) => index === hole ? null : item), score: Math.max(0, state.score - 2), sleeperHits: state.sleeperHits + 1, combo: 0 }, kind: 'sleeper' }
  }
  const inWindow = state.elapsedMs - state.lastHitMs <= COMBO_WINDOW_MS
  const combo = inWindow ? state.combo + 1 : 1
  return {
    state: {
      ...state,
      holes: state.holes.map((item, index) => index === hole ? null : item),
      combo,
      lastHitMs: state.elapsedMs,
      hits: state.hits + 1,
      score: state.score + comboFactor(combo)
    },
    kind: 'hit'
  }
}
