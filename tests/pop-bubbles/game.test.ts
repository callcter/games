import { expect, it } from 'vitest'
import { hitTest, newGame, pop, step } from '../../src/games/pop-bubbles/core/game'

it('rejects invalid modes and starts empty with deterministic first spawn', () => {
  expect(() => newGame(3)).toThrow('无效难度')
  const state = newGame(1, () => 0.5)
  expect(state.bubbles).toEqual([])
  expect(state).toEqual(newGame(1, () => 0.5))
})

it('bubbles rise, grow and disappear past the top', () => {
  let state = { ...newGame(0, () => 0.5), bubbles: [{ x: 384, y: 700, radius: 20, golden: false }], spawnIn: 100000 }
  for (let i = 0; i < 20; i++) state = step(state, 100, () => 0.5)
  // 2 秒内：上升 58*2=116px、半径 +12，未到顶则仍存在
  if (state.bubbles.length) {
    expect(state.bubbles[0]!.y).toBeLessThan(700)
    expect(state.bubbles[0]!.radius).toBeCloseTo(32, 1)
  }
  state = { ...state, bubbles: [{ x: 384, y: 230, radius: 20, golden: false }] }
  state = step(state, 1000, () => 0.5)
  expect(state.bubbles).toEqual([])
})

it('spawns bubbles on schedule within the field', () => {
  const state = newGame(1, () => 0.9)
  let next = state
  let spawned = 0
  for (let i = 0; i < 10; i++) {
    const before = next.bubbles.length
    next = step(next, 100, () => 0.9)
    if (next.bubbles.length > before) {
      spawned++
      const bubble = next.bubbles.at(-1)!
      expect(bubble.x).toBeGreaterThanOrEqual(80)
      expect(bubble.x).toBeLessThanOrEqual(688)
      expect(bubble.y).toBe(880)
    }
  }
  // 悠闲间隔 520ms*(0.72+0.9*0.56)≈0.65~1.23 倍，1 秒大约出 1~2 个
  expect(spawned).toBeGreaterThanOrEqual(1)
  expect(spawned).toBeLessThanOrEqual(3)
})

it('hitTest allows touch tolerance and prefers the smallest overlapping bubble', () => {
  const state = {
    ...newGame(0),
    bubbles: [
      { x: 384, y: 500, radius: 40, golden: false },
      { x: 384, y: 500, radius: 18, golden: false }
    ]
  }
  expect(hitTest(state, 384 + 46, 500)).toBe(0)
  expect(hitTest(state, 384, 500)).toBe(1)
  expect(hitTest(state, 100, 200)).toBe(-1)
})

it('scores small bubbles higher and golden bubbles triple', () => {
  const base = newGame(0)
  let state = pop({ ...base, bubbles: [{ x: 0, y: 0, radius: 20, golden: false }] }, 0)
  expect(state.score).toBe(3)
  state = pop({ ...state, bubbles: [{ x: 0, y: 0, radius: 40, golden: false }] }, 0)
  expect(state.score).toBe(4)
  state = pop({ ...state, bubbles: [{ x: 0, y: 0, radius: 20, golden: true }] }, 0)
  expect(state.score).toBe(13)
  expect(pop(state, 99)).toBe(state)
  expect(state.popped).toBe(3)
})
