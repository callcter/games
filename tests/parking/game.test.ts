import { describe, expect, it } from 'vitest'
import { EXIT_ROW, legalTargets, MODES, newGame, SIZE, slide, solve, type ParkState } from '../../src/games/parking/core/game'

const stateOf = (cars: ParkState['cars']): ParkState => ({ cars, moves: 0, won: false })

describe('停车场规则', () => {
  it('车辆只能沿自身朝向滑动且不能穿越或重叠', () => {
    const state = stateOf([
      { id: 0, x: 1, y: EXIT_ROW, len: 2, horizontal: true },
      { id: 1, x: 3, y: EXIT_ROW, len: 2, horizontal: true },
      { id: 2, x: 5, y: 0, len: 3, horizontal: false }
    ])
    // 主车右移 1 格会被 id1 挡住
    expect(slide(state, 0, 2)).toBeNull()
    // 主车左移 1 格畅通
    const left = slide(state, 0, 0)
    expect(left).not.toBeNull()
    expect(left!.cars[0]).toMatchObject({ x: 0, y: EXIT_ROW })
    expect(left!.moves).toBe(1)
    // 越界拒绝
    expect(slide(state, 0, -1)).toBeNull()
    expect(slide(state, 1, 5)).toBeNull()
    // 未知车辆拒绝
    expect(slide(state, 99, 0)).toBeNull()
    // 原状态不被修改
    expect(state.cars[0]!.x).toBe(1)
    expect(state.moves).toBe(0)
  })
  it('主车滑到出口位即胜利', () => {
    const state = stateOf([
      { id: 0, x: 1, y: EXIT_ROW, len: 2, horizontal: true },
      { id: 1, x: 0, y: 0, len: 2, horizontal: false }
    ])
    const exit = slide(state, 0, SIZE - 2 + 1)
    expect(exit).not.toBeNull()
    expect(exit!.won).toBe(true)
    // 胜利后不再接受移动
    expect(slide(exit!, 1, 1)).toBeNull()
  })
  it('legalTargets 列出连续可达的空位', () => {
    const state = stateOf([
      { id: 0, x: 1, y: EXIT_ROW, len: 2, horizontal: true },
      { id: 1, x: 3, y: EXIT_ROW, len: 2, horizontal: true }
    ])
    expect(legalTargets(state, 0)).toEqual([0])
    expect(legalTargets(state, 1)).toEqual([4])
  })
  it('BFS 求解与已知布局一致', () => {
    // 主车右移一步即出：1 步。
    expect(solve(stateOf([{ id: 0, x: 3, y: EXIT_ROW, len: 2, horizontal: true }]))).toBe(1)
    // 挡路车（长 3）必须滑离出口行再开出：2 步。
    expect(solve(stateOf([
      { id: 0, x: 2, y: EXIT_ROW, len: 2, horizontal: true },
      { id: 1, x: 4, y: 0, len: 3, horizontal: false }
    ]))).toBe(2)
    // 出口被长度 3 的竖车完全堵死且无法挪开（上顶格、下被占）时无解。
    const blocked = stateOf([
      { id: 0, x: 1, y: EXIT_ROW, len: 2, horizontal: true },
      { id: 1, x: 4, y: 0, len: 3, horizontal: false },
      { id: 2, x: 4, y: 3, len: 3, horizontal: false }
    ])
    expect(solve(blocked)).toBe(-1)
  })
})

describe('停车场生成器', () => {
  it('恒定随机源也不能让挑战档退化为两步局', { timeout: 60000 }, () => {
    for (const [mode, config] of MODES.entries()) {
      const state = newGame(mode, () => 0.5)
      const steps = solve(state)
      expect(steps).toBeGreaterThanOrEqual(config.min)
      expect(steps).toBeLessThanOrEqual(config.max)
    }
  })
  it('固定随机下三档都能生成合法、可解且步数在带内的关卡', { timeout: 60000 }, () => {
    for (const [mode, config] of MODES.entries()) {
      let seed = 31 + mode * 977
      const random = (): number => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      const rounds = mode === 0 ? 2 : 1
      for (let round = 0; round < rounds; round++) {
        const state = newGame(mode, random)
        expect(state.cars).toHaveLength(config.cars)
        expect(state.cars[0]).toMatchObject({ y: EXIT_ROW, horizontal: true })
        const cells = state.cars.flatMap(car => Array.from({ length: car.len }, (_, i) => car.horizontal ? car.y * SIZE + car.x + i : (car.y + i) * SIZE + car.x))
        expect(new Set(cells).size).toBe(cells.length) // 无重叠
        expect(cells.every(cell => cell >= 0 && cell < SIZE * SIZE)).toBe(true)
        expect(state.won).toBe(false)
        const steps = solve(state)
        expect(steps).toBeGreaterThanOrEqual(config.min)
        expect(steps).toBeLessThanOrEqual(config.max)
      }
    }
  })
})
