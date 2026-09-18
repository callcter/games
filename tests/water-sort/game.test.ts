import { describe, expect, it } from 'vitest'
import { canPour, MODES, newGame, pour, solvable, solvePath, topRun, TUBE_CAPACITY, type WaterState } from '../../src/games/water-sort/core/game'
import { restoreWaterSort } from '../../src/games/puzzle-kit/core/drafts'

describe('水排序规则', () => {
  it('旧四色进阶和五色挑战存档保留原棋盘及撤销历史', () => {
    for (const [mode, colors] of [[1, 4], [2, 5]] as const) {
      const tubes = Array.from({ length: colors }, (_, c) => [c, c, c, c])
      tubes.push([], [])
      tubes[0]![3] = 1
      tubes[1]![3] = 0
      const state = { tubes, colors, moves: 4, won: false }
      expect(restoreWaterSort({ state, history: [state], mode })).toMatchObject({ mode, state: { colors, tubes }, history: [{ colors, tubes }] })
      expect(restoreWaterSort({ state: { ...state, colors: 99 }, mode })).toBeNull()
    }
  })
  it('顶部连续同色段统计正确', () => {
    expect(topRun([])).toBe(0)
    expect(topRun([1, 2, 2])).toBe(2)
    expect(topRun([3, 3, 3, 3])).toBe(4)
    expect(topRun([1, 1, 2, 2])).toBe(2)
  })
  it('合法倒水受目标容量截断并推进完成判定', () => {
    const state: WaterState = { tubes: [[0, 0, 1, 1], [1, 1, 0, 0], []], colors: 2, moves: 0, won: false }
    expect(canPour(state, 0, 2)).toBe(true)
    const first = pour(state, 0, 2)!
    expect(first.poured).toBe(2)
    expect(first.state.tubes[0]).toEqual([0, 0])
    expect(first.state.tubes[2]).toEqual([1, 1])
    expect(first.state.moves).toBe(1)
    expect(first.state.won).toBe(false)
    const second = pour(first.state, 1, 0)!
    expect(second.state.tubes[0]).toEqual([0, 0, 0, 0])
    expect(second.state.won).toBe(false)
    const final = pour(second.state, 1, 2)!
    expect(final.state.tubes[2]).toEqual([1, 1, 1, 1])
    expect(final.state.won).toBe(true)
  })
  it('非法倒水返回 null 且不改动原状态', () => {
    const state: WaterState = { tubes: [[0, 1], [2, 2, 2, 2], [1, 1]], colors: 3, moves: 0, won: false }
    expect(pour(state, 0, 0)).toBeNull()
    expect(pour(state, 2, 2)).toBeNull()
    expect(pour(state, 99, 0)).toBeNull()
    expect(pour(state, 0, 1)).toBeNull() // 目标已满
    expect(pour(state, 0, 1)).toBeNull() // 顶色不同
    expect(state.tubes).toEqual([[0, 1], [2, 2, 2, 2], [1, 1]])
    expect(state.moves).toBe(0)
    expect(pour({ ...state, won: true }, 0, 2)).toBeNull()
  })
})

describe('水排序生成器', () => {
  it('垂直切片 v1：两根空瓶 + 解路径长度带 + 真实求解验证（每档 20 局）', () => {
    const mulberry32 = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    for (const [mode, config] of MODES.entries()) {
      expect(config.empties).toBe(2) // v1 设计：难度靠颜色数+解路径长度，不靠减空瓶制造挫败
      for (let seed = 1; seed <= 20; seed++) {
        const state = newGame(mode, mulberry32(seed))
        expect(state.tubes).toHaveLength(config.colors + 2)
        expect(state.tubes.filter(tube => tube.length).every(tube => tube.length === TUBE_CAPACITY)).toBe(true)
        expect(state.tubes.some(tube => tube.length === TUBE_CAPACITY && new Set(tube).size === 1)).toBe(false)
        // 真实求解：solvePath 非空且按路径倒完必胜
        const path = solvePath(state)
        expect(path).not.toBeNull()
        expect(path!.length).toBeGreaterThanOrEqual(config.minSolution)
        let current = state
        for (const move of path!) current = pour(current, move.from, move.to)!.state
        expect(current.won).toBe(true)
      }
    }
  }, 120000)
  it('三档难度固定随机下生成结构正确、无已完成管、重放解必胜的局面', () => {
    for (const [mode, config] of MODES.entries()) {
      let seed = 1 + mode * 1000
      const random = (): number => { // mulberry32：imul 保证整数精度
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      for (let round = 0; round < 3; round++) {
        const state = newGame(mode, random)
        expect(state.tubes).toHaveLength(config.colors + config.empties)
        expect(state.tubes.every(tube => tube.length <= TUBE_CAPACITY)).toBe(true)
        const layers = state.tubes.flat()
        expect(layers).toHaveLength(config.colors * TUBE_CAPACITY)
        for (let color = 0; color < config.colors; color++) expect(layers.filter(layer => layer === color)).toHaveLength(TUBE_CAPACITY)
        expect(state.tubes.some(tube => tube.length === TUBE_CAPACITY && topRun(tube) === TUBE_CAPACITY)).toBe(false)
        expect(solvable(state)).toBe(true)
      }
    }
  })
  it('小局面求解器与构造解一致，能识别死局', () => {
    expect(solvable(newGame(0, () => 0.42))).toBe(true)
    // 2 管都满且互相卡色，无空管可用。
    const stuck: WaterState = { tubes: [[0, 1, 0, 1], [1, 0, 1, 0]], colors: 2, moves: 0, won: false }
    expect(solvable(stuck)).toBe(false)
  })
})
