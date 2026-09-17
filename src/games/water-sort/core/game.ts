import { type RandomSource } from '../../cards/core/cards'

// 水排序：把混色水层倒回单色试管。规则层不持有 Phaser/DOM 依赖，随机由注入源提供。

export const TUBE_CAPACITY = 4

export interface WaterState {
  /** 每根试管自底向顶的颜色层；空管为空数组。 */
  tubes: number[][]
  colors: number
  moves: number
  won: boolean
}

export const MODES: readonly { label: string; colors: number; empties: number }[] = [
  { label: '基础', colors: 3, empties: 2 },
  { label: '进阶', colors: 5, empties: 2 },
  { label: '挑战', colors: 6, empties: 2 }
]

/** 试管顶部连续同色层的数量。 */
export function topRun(tube: readonly number[]): number {
  if (!tube.length) return 0
  const top = tube[tube.length - 1]!
  let run = 1
  while (run < tube.length && tube[tube.length - 1 - run] === top) run++
  return run
}

function isUniform(tube: readonly number[]): boolean {
  return tube.length > 0 && topRun(tube) === tube.length
}

export function canPour(state: WaterState, from: number, to: number): boolean {
  if (from === to || !state.tubes[from]?.length || state.tubes[to] === undefined) return false
  if (state.won) return false
  const source = state.tubes[from]!, target = state.tubes[to]!
  return target.length < TUBE_CAPACITY && (target.length === 0 || target[target.length - 1] === source[source.length - 1])
}

/** 把 from 顶部连续同色层倒入 to（受目标剩余容量截断）；非法时返回 null 且不改状态。 */
export function pour(state: WaterState, from: number, to: number): { state: WaterState; poured: number } | null {
  if (!canPour(state, from, to)) return null
  const source = state.tubes[from]!, target = state.tubes[to]!
  const poured = Math.min(topRun(source), TUBE_CAPACITY - target.length)
  const tubes = state.tubes.map((tube, index) =>
    index === from ? tube.slice(0, tube.length - poured) : index === to ? [...tube, ...source.slice(-poured)] : tube)
  return { state: { ...state, tubes, moves: state.moves + 1, won: tubes.every(tube => !tube.length || (tube.length === TUBE_CAPACITY && isUniform(tube))) }, poured }
}

/**
 * DFS 验证局面可解。已完成的单色满管不再倒出；空管彼此等价只试第一个；
 * 优先归并同色顶。设节点上限防止病态局面长时间占用。
 */
export function solvable(state: WaterState, nodeLimit = 150000): boolean {
  if (state.won) return true
  const seen = new Set<string>()
  const search = (tubes: number[][], nodes: { left: number }): boolean => {
    if (tubes.every(tube => !tube.length || (tube.length === TUBE_CAPACITY && isUniform(tube)))) return true
    if (nodes.left-- <= 0) return false
    const signature = tubes.map(tube => tube.join(',')).sort().join('|')
    if (seen.has(signature)) return false
    seen.add(signature)
    const emptyUsed = new Set<number>()
    const options: { from: number; to: number; merge: boolean }[] = []
    for (let from = 0; from < tubes.length; from++) {
      const source = tubes[from]!
      if (!source.length || (source.length === TUBE_CAPACITY && isUniform(source))) continue
      for (let to = 0; to < tubes.length; to++) {
        if (from === to) continue
        const target = tubes[to]!
        if (target.length >= TUBE_CAPACITY) continue
        if (!target.length) {
          if (emptyUsed.size) continue
          emptyUsed.add(0)
        } else if (target[target.length - 1] !== source[source.length - 1]) continue
        options.push({ from, to, merge: target.length > 0 })
      }
    }
    options.sort((a, b) => Number(b.merge) - Number(a.merge))
    for (const option of options) {
      const source = tubes[option.from]!, target = tubes[option.to]!
      const moved = Math.min(topRun(source), TUBE_CAPACITY - target.length)
      const next = tubes.map((tube, index) =>
        index === option.from ? tube.slice(0, tube.length - moved) : index === option.to ? [...tube, ...source.slice(-moved)] : tube)
      if (search(next, nodes)) return true
    }
    return false
  }
  return search(state.tubes.map(tube => [...tube]), { left: nodeLimit })
}

/**
 * 反向构造生成：从完成态（每色一管）出发执行随机「逆倒水」——
 * 把某管顶部 1..min(顶段, 空间) 层移入「空管或顶色相同的管」。
 * 放宽的逆操作不再保证记录序列可直接重放，因此生成后用 greedySolves 复核
 * （贪心+随机重试，找到解即真可解，大局面下远快于完备搜索）；
 * 反向构造出的局面远比随机洗牌接近可解，复核通常立刻命中。
 * 初始局面不允许已完成的单色满管（避免白送一步），不达标换一轮重来。
 */
/** 贪心求解复核：优先「目标管变满 / 倒空源管 / 归并同色」的强动作，平局用随机
 * 打破；多次重试只要有一次全清即真可解。弱于完备搜索（solvable，留作小局面
 * 与死局测试），但大局面下足够快。 */
export function greedySolves(state: WaterState, random: RandomSource = Math.random, tries = 60): boolean {
  for (let attempt = 0; attempt < tries; attempt++) {
    let tubes = state.tubes.map(tube => [...tube])
    for (let step = 0; step < 220; step++) {
      if (tubes.every(tube => !tube.length || (tube.length === TUBE_CAPACITY && isUniform(tube)))) return true
      const options: { from: number; to: number; score: number }[] = []
      for (let from = 0; from < tubes.length; from++) {
        const source = tubes[from]!
        if (!source.length || (source.length === TUBE_CAPACITY && isUniform(source))) continue
        const run = topRun(source)
        for (let to = 0; to < tubes.length; to++) {
          if (from === to) continue
          const target = tubes[to]!
          if (target.length >= TUBE_CAPACITY) continue
          if (target.length && target[target.length - 1] !== source[source.length - 1]) continue
          if (!target.length && tubes.some((tube, index) => !tube.length && index < to)) continue // 空管等价只试首个
          const moved = Math.min(run, TUBE_CAPACITY - target.length)
          options.push({
            from, to,
            score: (target.length ? 2 : 0) + (moved === source.length ? 2 : 0) + (moved + target.length === TUBE_CAPACITY ? 3 : 0) + random()
          })
        }
      }
      if (!options.length) break
      const best = options.reduce((a, b) => b.score > a.score ? b : a)
      const source = tubes[best.from]!, target = tubes[best.to]!
      const moved = Math.min(topRun(source), TUBE_CAPACITY - target.length)
      tubes = tubes.map((tube, index) =>
        index === best.from ? tube.slice(0, tube.length - moved) : index === best.to ? [...tube, ...source.slice(-moved)] : tube)
    }
  }
  return false
}

export function newGame(mode: number, random: RandomSource = Math.random): WaterState {
  const config = MODES[mode] ?? MODES[0]!
  const pick = <T>(list: readonly T[]): T | undefined => list.length ? list[Math.floor(random() * list.length)] : undefined

  for (let attempt = 0; ; attempt++) {
    const tubes: number[][] = Array.from({ length: config.colors }, (_, color) => Array.from({ length: TUBE_CAPACITY }, () => color))
    for (let index = 0; index < config.empties; index++) tubes.push([])
    const backward = (from: number, forced = false): boolean => {
      const source = tubes[from]!
      if (!source.length) return false
      const color = source[source.length - 1]!, run = topRun(source)
      const receivers: { to: number; k: number }[] = []
      const fallbacks: { to: number; k: number }[] = []
      for (let to = 0; to < tubes.length; to++) {
        if (to === from) continue
        const target = tubes[to]!
        const top = target.length ? target[target.length - 1]! : -1
        const maxK = Math.min(run, TUBE_CAPACITY - target.length)
        for (let k = 1; k <= maxK; k++) {
          // 不把接收方凑成单色满管，否则初始局面出现已完成管（空管装满 4 层必为单色）。
          if (k + target.length === TUBE_CAPACITY && (!target.length || isUniform(target))) continue
          const entry = { to, k }
          if (!target.length || top === color) receivers.push(entry)
          else fallbacks.push(entry) // 异色接收只用于强制打散
        }
      }
      const choice = pick(receivers) ?? (forced ? pick(fallbacks) : undefined)
      if (!choice) return false
      tubes[from] = source.slice(0, source.length - choice.k)
      tubes[choice.to] = [...tubes[choice.to]!, ...source.slice(-choice.k)]
      return true
    }
    const steps = config.colors * 3 + 10 + Math.floor(random() * 8)
    for (let index = 0; index < steps; index++) {
      const nonEmpty = tubes.map((_, i) => i).filter(i => tubes[i]!.length)
      const from = pick(nonEmpty)
      if (from !== undefined) backward(from)
    }
    // 打散残留的单色满管（多数是生成过程中从未被挑中的原始管）。
    for (let guard = 0; guard < tubes.length * 2; guard++) {
      if (!tubes.some(tube => tube.length === TUBE_CAPACITY && isUniform(tube))) break
      const done = tubes.findIndex(tube => tube.length === TUBE_CAPACITY && isUniform(tube))
      if (!backward(done, true)) break
    }
    const hasFinished = tubes.some(tube => tube.length === TUBE_CAPACITY && isUniform(tube))
    const state: WaterState = { tubes, colors: config.colors, moves: 0, won: false }
    if (!hasFinished && greedySolves(state, random)) return state
    if (attempt >= 40) throw new Error(`水排序生成失败：连续 41 轮未得到可解局面`)
  }
}
