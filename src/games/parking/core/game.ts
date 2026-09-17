import { type RandomSource } from '../../cards/core/cards'

// 停车场（Rush Hour 类）：车辆只能沿自身朝向滑动，把红色主车从右侧出口开出。
// 6×6 网格，出口在第 2 行最右。规则层无 Phaser/DOM 依赖，随机由注入源提供。

export const SIZE = 6
export const EXIT_ROW = 2

export interface Car {
  id: number
  /** 车头左/上端的主轴坐标与行/列位置。 */
  x: number
  y: number
  len: number
  horizontal: boolean
}

export interface ParkState {
  cars: Car[]
  moves: number
  won: boolean
}

export const MODES: readonly { label: string; cars: number; min: number; max: number }[] = [
  { label: '轻松', cars: 6, min: 3, max: 8 },
  { label: '标准', cars: 8, min: 8, max: 18 },
  { label: '挑战', cars: 10, min: 11, max: 40 }
]

/** 主车固定 id 0、横向、停在出口行；开出位主轴坐标为 SIZE - len + 1。 */
export function heroExit(cars: readonly Car[]): number {
  return SIZE - cars[0]!.len + 1
}

function axis(car: Car): number {
  return car.horizontal ? car.x : car.y
}

function cells(car: Car): number[] {
  return Array.from({ length: car.len }, (_, index) => car.horizontal ? car.y * SIZE + car.x + index : (car.y + index) * SIZE + car.x)
}

function occupied(cars: readonly Car[], skip: number): Set<number> {
  const taken = new Set<number>()
  cars.forEach(car => { if (car.id !== skip) for (const cell of cells(car)) taken.add(cell) })
  return taken
}

/** 车在主轴 position 时是否与界内其他车冲突；主车允许车尾段滑出出口。 */
function clearAt(car: Car, position: number, taken: ReadonlySet<number>): boolean {
  for (let step = 0; step < car.len; step++) {
    const x = car.horizontal ? position + step : car.x
    const y = car.horizontal ? car.y : position + step
    if (car.id === 0 && x >= SIZE) continue // 主车越界段在出口外，不占格
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return false
    if (taken.has(y * SIZE + x)) return false
  }
  return true
}

/** 车 id 的主轴可达坐标（滑行路径全程畅通）。 */
export function legalTargets(state: ParkState, id: number): number[] {
  const car = state.cars.find(entry => entry.id === id)
  if (!car || state.won) return []
  const taken = occupied(state.cars, id)
  const limit = car.id === 0 ? heroExit(state.cars) : SIZE - car.len
  const targets: number[] = []
  for (let position = 0; position <= limit; position++) {
    if (position === axis(car)) continue
    const [lo, hi] = position < axis(car) ? [position, axis(car)] : [axis(car), position]
    let free = true
    for (let between = lo; between <= hi; between++) if (!clearAt(car, between, taken)) { free = false; break }
    if (free) targets.push(position)
  }
  return targets
}

/** 把车 id 滑到主轴坐标 to（主车滑到开出位即胜利）；非法返回 null 且不改状态。 */
export function slide(state: ParkState, id: number, to: number): ParkState | null {
  const car = state.cars.find(entry => entry.id === id)
  if (!car || state.won || to === axis(car)) return null
  if (!legalTargets(state, id).includes(to)) return null
  const cars = state.cars.map(entry => entry.id === id
    ? (entry.horizontal ? { ...entry, x: to } : { ...entry, y: to })
    : entry)
  return { cars, moves: state.moves + 1, won: car.id === 0 && to === heroExit(state.cars) }
}

/** BFS 最少「移动一辆车」步数；无解或超过 maxDepth 返回 -1。
 * 状态转移复用规则层的 legalTargets/slide，保证求解与实际走子完全一致。 */
export function solve(state: ParkState, nodeLimit = 60000, maxDepth = Infinity): number {
  const exit = heroExit(state.cars)
  const keyOf = (cars: readonly Car[]): string => cars.map(car => (car.horizontal ? car.x : car.y)).join(',')
  const queue: [cars: Car[], steps: number][] = [[state.cars, 0]]
  const seen = new Set([keyOf(state.cars)])
  let head = 0, processed = 0
  while (head < queue.length) {
    const [cars, steps] = queue[head++]!
    if (cars[0]!.x === exit) return steps
    if (processed++ > nodeLimit || steps >= maxDepth) continue
    const live: ParkState = { cars, moves: 0, won: false }
    for (let id = 0; id < cars.length; id++) {
      for (const target of legalTargets(live, id)) {
        const moved = slide(live, id, target)
        if (!moved) continue
        const key = keyOf(moved.cars)
        if (!seen.has(key)) { seen.add(key); queue.push([moved.cars, steps + 1]) }
      }
    }
  }
  return -1
}

/** 随机布局 + BFS 步数带过滤生成；主车必在出口行且初始未开出。 */
export function newGame(mode: number, random: RandomSource = Math.random): ParkState {
  const config = MODES[mode] ?? MODES[0]!
  for (let attempt = 0; attempt < 8; attempt++) {
    const cars: Car[] = []
    const taken = new Set<number>()
    const place = (car: Car): boolean => {
      const cellsOf = cells(car)
      if (cellsOf.some(cell => cell < 0 || cell >= SIZE * SIZE || taken.has(cell))) return false
      cellsOf.forEach(cell => taken.add(cell))
      cars.push(car)
      return true
    }
    const heroX = 1 + Math.floor(random() * 3) // 1..3，保证出口方向仍有路可堵
    place({ id: 0, x: heroX, y: EXIT_ROW, len: 2, horizontal: true })
    // 出口行先埋 1-2 辆竖车挡住去路，保证关卡需要绕行而不是一步滑出。
    for (let blocker = 0; blocker < Math.ceil(config.cars / 6); blocker++) {
      for (let tries = 0; tries < 24; tries++) {
        const x = heroX + 1 + Math.floor(random() * (SIZE - heroX - 1))
        const len = random() < 0.5 ? 2 : 3
        const y = random() < 0.5 ? 0 : Math.min(SIZE - len, EXIT_ROW)
        if (place({ id: cars.length, x, y, len, horizontal: false })) break
      }
    }
    let guard = 0
    while (cars.length < config.cars && guard++ < 500) {
      const horizontal = random() < 0.5
      const len = random() < 0.72 ? 2 : 3
      const limit = SIZE - len
      const x = horizontal ? Math.floor(random() * (limit + 1)) : Math.floor(random() * SIZE)
      const y = horizontal ? Math.floor(random() * SIZE) : Math.floor(random() * (limit + 1))
      // 出口行上的横车容易把主车直接堵死或秒开，限制数量。
      if (horizontal && y === EXIT_ROW) continue
      place({ id: cars.length, x, y, len, horizontal })
    }
    if (cars.length < config.cars) continue
    const state: ParkState = { cars, moves: 0, won: false }
    const steps = solve(state, 2000, config.max)
    if (steps >= config.min && steps <= config.max) return state
  }
  return reserve(MODES.indexOf(config))
}

function reserve(mode: number): ParkState {
  // BFS 回归验证为 5 / 8 / 17 步。随机搜索预算耗尽时保持所选难度，
  // 每次新建车辆，避免调用方修改备用题库。元组为 x/y/长度/横向标记。
  const layouts: number[][][] = [
    [[1,2,2,1],[5,0,3,0],[3,3,2,0],[0,2,2,0],[4,3,2,1],[4,1,2,0]],
    [[1,2,2,1],[5,2,3,0],[3,2,3,0],[5,0,2,0],[4,5,2,1],[2,3,3,0],[3,0,2,0],[0,1,2,0]],
    [[1,2,2,1],[5,2,3,0],[5,0,2,0],[1,4,2,0],[0,3,2,1],[4,1,3,0],[4,5,2,1],[3,3,2,0],[3,0,2,0],[2,3,3,0]]
  ]
  return { cars: layouts[mode]!.map((row, id) => ({ id, x: row[0]!, y: row[1]!, len: row[2]!, horizontal: row[3] === 1 })), moves: 0, won: false }
}
