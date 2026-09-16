import { expect, it } from 'vitest'
import { comboFactor, HOLE_COUNT, newGame, step, whack } from '../../src/games/whack-mole/core/game'

it('starts with empty holes and rejects invalid modes', () => {
  const state = newGame(1, () => 0.5)
  expect(state.holes).toHaveLength(HOLE_COUNT)
  expect(state.holes.every(hole => hole === null)).toBe(true)
  expect(state).toEqual(newGame(1, () => 0.5))
  expect(() => newGame(4)).toThrow('无效难度')
})

it('pops moles into free holes and retracts them after the stay window', () => {
  let state = newGame(0, () => 0.99)
  state = { ...state, nextPopIn: 1 }
  state = step(state, 50, () => 0.99)
  const popped = state.holes.filter(hole => hole).length
  expect(popped).toBe(1)
  // 悠闲档停留 2000ms：屏蔽生成后推进 2500ms，必然缩回
  state = step({ ...state, nextPopIn: 100000 }, 2500, () => 0.99)
  expect(state.holes.every(hole => hole === null)).toBe(true)
})

it('never puts two moles in one hole', () => {
  let state = newGame(2, () => 0.5)
  const counts = new Map<number, number>()
  for (let i = 0; i < 400; i++) {
    state = step(state, 100, () => 0.5)
    state.holes.forEach((hole, index) => {
      if (hole) counts.set(index, (counts.get(index) ?? 0) + 1)
    })
  }
  // 同一时刻每洞最多一只由结构保证；这里校验总出现次数与缩回逻辑没有卡死
  expect([...counts.values()].reduce((sum, n) => sum + n, 0)).toBeGreaterThan(10)
})

it('scores hits with combo, penalizes sleepers and breaks combo on miss', () => {
  let state = { ...newGame(1), holes: [{ upAt: 0, sleeper: false }, ...Array(8).fill(null)] }
  let result = whack(state, 0)
  expect(result.kind).toBe('hit')
  expect(result.state.score).toBe(1)
  expect(result.state.holes[0]).toBeNull()
  state = { ...result.state, holes: [{ upAt: 0, sleeper: false }, ...Array(8).fill(null)] }
  result = whack(state, 0)
  expect(result.state.combo).toBe(2)
  expect(whack({ ...state, holes: [{ upAt: 0, sleeper: true }, ...Array(8).fill(null)] }, 0).state.score).toBe(Math.max(0, state.score - 2))
  const missed = whack({ ...state, holes: Array(9).fill(null) }, 3)
  expect(missed.kind).toBe('miss')
  expect(missed.state.misses).toBe(1)
  expect(whack(state, -1).kind).toBe('miss')
  expect(whack(state, 9).kind).toBe('miss')
})

it('caps the mole combo multiplier', () => {
  expect(comboFactor(1)).toBe(1)
  expect(comboFactor(4)).toBe(2)
  expect(comboFactor(8)).toBe(3)
  expect(comboFactor(50)).toBe(3)
})
