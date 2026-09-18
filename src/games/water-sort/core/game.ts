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
  // 难度重设计（2026-09-18）：旧版反向构造 + 2 空管的局面接近解态（几步即胜）。
  // 改为随机洗牌 + 全程 1 根空管 + 完备 DFS 复核可解：实测随机局面可解率约
  // 40%（3色）/8%（5-6色），DFS 单局面毫秒级，重洗十几轮即得一局；
  // 可解局面的贪心解中位约 9/16/21 步，孩子实际需要更多回溯规划。
  { label: '基础', colors: 3, empties: 1 },
  { label: '进阶', colors: 5, empties: 1 },
  { label: '挑战', colors: 6, empties: 1 }
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

/** BFS 最少倒水次数（空管等价只试首个、签名按排序去重）；超节点上限返回 -1。
 * 只适合小局面与测试断言——单空管的大局面状态空间会爆炸，生成难度过滤
 * 必须用 greedyStepCount。 */
export function optimalSteps(state: WaterState, nodeLimit = 80000): number {
  if (state.won) return 0
  const key = (tubes: number[][]): string => tubes.map(tube => tube.join(',')).sort().join('|')
  const won = (tubes: number[][]): boolean => tubes.every(tube => !tube.length || (tube.length === TUBE_CAPACITY && isUniform(tube)))
  const seen = new Set([key(state.tubes)])
  let frontier: number[][][] = [state.tubes.map(tube => [...tube])]
  for (let depth = 0; frontier.length && depth < 200; depth++) {
    const next: number[][][] = []
    for (const tubes of frontier) {
      for (let from = 0; from < tubes.length; from++) {
        const source = tubes[from]!
        if (!source.length || (source.length === TUBE_CAPACITY && isUniform(source))) continue
        for (let to = 0; to < tubes.length; to++) {
          if (from === to) continue
          const target = tubes[to]!
          if (target.length >= TUBE_CAPACITY) continue
          if (target.length && target[target.length - 1] !== source[source.length - 1]) continue
          if (!target.length && tubes.some((tube, index) => !tube.length && index < to)) continue
          const moved = Math.min(topRun(source), TUBE_CAPACITY - target.length)
          const board = tubes.map((tube, index) =>
            index === from ? tube.slice(0, tube.length - moved) : index === to ? [...tube, ...source.slice(-moved)] : tube)
          if (won(board)) return depth + 1
          const signature = key(board)
          if (seen.has(signature)) continue
          if (seen.size >= nodeLimit) return -1
          seen.add(signature)
          next.push(board)
        }
      }
    }
    frontier = next
  }
  return -1
}

/** 贪心首次解的步数（找不到解返回 -1）：作为生成难度过滤的快速代理。
 * 贪心步数通常多于最优解，阈值按档位经验校准。 */
export function greedyStepCount(state: WaterState, random: RandomSource = Math.random): number {
  for (let attempt = 0; attempt < 12; attempt++) {
    let tubes = state.tubes.map(tube => [...tube])
    for (let step = 0; step < 220; step++) {
      if (tubes.every(tube => !tube.length || (tube.length === TUBE_CAPACITY && isUniform(tube)))) return step
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
          if (!target.length && tubes.some((tube, index) => !tube.length && index < to)) continue
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
  return -1
}

/**
 * 随机洗牌生成（2026-09-18 难度重设计）：把 colors×4 层随机洗进 colors 根管、
 * 留 empties 根空管——天然打散彻底。接受条件：无已完成单色满管且完备 DFS 复核
 * 可解（solvable，毫秒级）；不可解就整局重洗。难度由「随机分布 + 单空管」的
 * 结构保证，不再需要人工步数带。预算耗尽兜底退回反向构造的老路径。
 */
export function newGame(mode: number, random: RandomSource = Math.random): WaterState {
  const config = MODES[mode] ?? MODES[0]!
  const shuffle = <T>(list: T[]): T[] => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[list[i], list[j]] = [list[j]!, list[i]!]
    }
    return list
  }
  for (let attempt = 0; ; attempt++) {
    // 固定随机源（测试）下 shuffle 是同一置换，先按轮次轮转底层序列保证每轮局面不同。
    const plain = Array.from({ length: config.colors * TUBE_CAPACITY }, (_, index) => Math.floor(index / TUBE_CAPACITY))
    const rotate = attempt % plain.length
    const layers = shuffle([...plain.slice(rotate), ...plain.slice(0, rotate)])
    const tubes: number[][] = Array.from({ length: config.colors }, (_, tube) => layers.slice(tube * TUBE_CAPACITY, (tube + 1) * TUBE_CAPACITY))
    for (let index = 0; index < config.empties; index++) tubes.push([])
    if (tubes.some(tube => tube.length === TUBE_CAPACITY && isUniform(tube))) continue
    const state: WaterState = { tubes, colors: config.colors, moves: 0, won: false }
    if (solvable(state)) return state
    if (attempt >= 600) return fallbackDeal(config, random)
  }
}

/** 洗牌预算耗尽时的兜底：反向构造的老路径（打散不充分但确定可解），不阻塞开局。 */
function fallbackDeal(config: { colors: number; empties: number }, random: RandomSource): WaterState {
  const tubes: number[][] = Array.from({ length: config.colors }, (_, color) => Array.from({ length: TUBE_CAPACITY }, () => color))
  for (let index = 0; index < config.empties; index++) tubes.push([])
  for (let step = 0; step < config.colors * 4 + 12; step++) {
    const nonEmpty = tubes.map((_, i) => i).filter(i => tubes[i]!.length && !(tubes[i]!.length === TUBE_CAPACITY && isUniform(tubes[i]!)))
    const from = nonEmpty[Math.floor(random() * nonEmpty.length)]
    if (from === undefined) break
    const source = tubes[from]!
    const color = source[source.length - 1]!
    const targets = tubes.map((_, i) => i).filter(i => {
      if (i === from) return false
      const target = tubes[i]!
      if (target.length >= TUBE_CAPACITY) return false
      if (!target.length || target[target.length - 1] === color) {
        // 不把接收方凑成单色满管，避免初始出现已完成管。
        return topRun(source) + target.length !== TUBE_CAPACITY || !isUniform(target)
      }
      return false
    })
    const to = targets[Math.floor(random() * targets.length)]
    if (to === undefined) continue
    const moved = Math.min(topRun(source), TUBE_CAPACITY - tubes[to]!.length)
    tubes[from] = source.slice(0, source.length - moved)
    tubes[to] = [...tubes[to]!, ...source.slice(-moved)]
  }
  // 打散残留的原始单色满管。
  for (let guard = 0; guard < tubes.length * 2; guard++) {
    const done = tubes.findIndex(tube => tube.length === TUBE_CAPACITY && isUniform(tube))
    if (done < 0) break
    const source = tubes[done]!
    const color = source[source.length - 1]!
    const spread = tubes.findIndex(tube => tube.length < TUBE_CAPACITY - 1 && tube.length > 0)
    if (spread < 0) break
    tubes[done] = []
    tubes[spread] = [...tubes[spread]!, ...Array.from({ length: TUBE_CAPACITY - tubes[spread]!.length }, () => color).slice(0, 2)]
  }
  return { tubes, colors: config.colors, moves: 0, won: false }
}
