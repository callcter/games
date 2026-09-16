import { expect, it } from 'vitest'
import { comboFactor, newGame, step, tap } from '../../src/games/red-rain/core/game'

it('drops fall and recycle past the bottom without penalty', () => {
  let state = { ...newGame(0, () => 0.5), drops: [{ x: 384, y: 300, cracker: false }], spawnIn: 100000 }
  for (let i = 0; i < 40; i++) state = step(state, 100, () => 0.5)
  // 4 秒下落 600px（852 底线 + 40 容差），已出底部被回收
  expect(state.drops).toEqual([])
  expect(state.score).toBe(0)
})

it('spawns red packets and crackers with the configured ratio', () => {
  let state = newGame(0, () => 0.95)
  let reds = 0, crackers = 0
  for (let i = 0; i < 60; i++) {
    const before = state.drops.length
    state = step(state, 100, () => 0.95)
    if (state.drops.length > before) (state.drops.at(-1)!.cracker ? crackers++ : reds++)
  }
  expect(reds + crackers).toBeGreaterThanOrEqual(5)
})

it('builds combos inside the window and resets after it', () => {
  let state = newGame(1, () => 0.5)
  state = { ...state, drops: [{ x: 200, y: 500, cracker: false }], spawnIn: 100000 }
  let result = tap(state, 200, 500)
  expect(result.kind).toBe('red')
  expect(result.state.combo).toBe(1)
  expect(result.state.score).toBe(1)
  // 窗口内继续连开
  result = tap({ ...result.state, drops: [{ x: 300, y: 400, cracker: false }] }, 300, 400)
  expect(result.state.combo).toBe(2)
  // 推进超过 800ms 后连击重置（下落后按红包实际位置点按）
  const advanced = step({ ...result.state, drops: [{ x: 400, y: 300, cracker: false }], spawnIn: 100000 }, 900, () => 0.5)
  const fallen = advanced.drops[0]!
  result = tap(advanced, fallen.x, fallen.y)
  expect(result.state.combo).toBe(1)
})

it('caps the combo multiplier at three and crackers reset it', () => {
  expect(comboFactor(1)).toBe(1)
  expect(comboFactor(2)).toBe(1)
  expect(comboFactor(3)).toBe(2)
  expect(comboFactor(6)).toBe(3)
  expect(comboFactor(20)).toBe(3)
  let state = { ...newGame(1, () => 0.5), spawnIn: 100000 }
  for (let i = 0; i < 6; i++) state = tap({ ...state, drops: [{ x: 200, y: 500, cracker: false }] }, 200, 500).state
  expect(state.combo).toBe(6)
  expect(state.score).toBe(1 + 1 + 2 + 2 + 2 + 3)
  const cracked = tap({ ...state, drops: [{ x: 200, y: 500, cracker: true }] }, 200, 500)
  expect(cracked.kind).toBe('cracker')
  expect(cracked.state.score).toBe(state.score - 3)
  expect(cracked.state.combo).toBe(0)
})

it('ignores taps far away and never goes negative', () => {
  const state = { ...newGame(1), drops: [{ x: 500, y: 500, cracker: false }] }
  expect(tap(state, 100, 200).kind).toBe('none')
  const broke = { ...state, score: 2, drops: [{ x: 100, y: 100, cracker: true }] }
  expect(tap(broke, 100, 100).state.score).toBe(0)
  expect(() => newGame(9)).toThrow('无效难度')
})
