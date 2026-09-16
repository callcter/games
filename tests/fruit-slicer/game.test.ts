import { expect, it } from 'vitest'
import { endSwipe, FRUITS, newGame, slice, step } from '../../src/games/fruit-slicer/core/game'

it('throws fruits upward along a parabola and recycles them below the screen', () => {
  let state = { ...newGame(0, () => 0.5), fruits: [{ x: 384, y: 900, vx: 0, vy: -1000, kind: 0, bomb: false }], spawnIn: 100000 }
  state = step(state, 300, () => 0.5)
  expect(state.fruits[0]!.y).toBeLessThan(900)
  state = step(state, 500, () => 0.5)
  // 800ms 后重力把 vy 拉正，开始下落
  expect(state.fruits[0]!.vy).toBeGreaterThan(0)
  // 正常运行时每帧步长很小；用小步长推进 3 秒，水果落出屏幕被回收
  for (let i = 0; i < 30; i++) state = step(state, 100, () => 0.5)
  expect(state.fruits).toEqual([])
})

it('spawns waves of one or two fruits with bombs mixed in', () => {
  let state = newGame(1, () => 0.9)
  // 新抛出的水果固定从发射线出发，以此统计生成次数（老水果可能已落出屏幕）
  let waves = 0
  for (let i = 0; i < 40; i++) {
    state = step(state, 100, () => 0.9)
    if (state.fruits.some(fruit => fruit.y >= 905)) waves++
  }
  expect(waves).toBeGreaterThanOrEqual(2)
  // 抛出瞬间的水果位于发射线且横向在场内（飞行中允许横向漂出屏）
  const fresh = state.fruits.filter(fruit => fruit.y >= 905)
  fresh.forEach(fruit => {
    expect(fruit.x).toBeGreaterThanOrEqual(100)
    expect(fruit.x).toBeLessThanOrEqual(668)
    expect(fruit.kind).toBeLessThan(FRUITS.length)
  })
  expect(() => newGame(5)).toThrow('无效难度')
})

it('slices fruits crossed by the swipe segment only', () => {
  const state = {
    ...newGame(0),
    fruits: [
      { x: 384, y: 500, vx: 0, vy: 0, kind: 0, bomb: false },
      { x: 384, y: 640, vx: 0, vy: 0, kind: 1, bomb: false },
      { x: 200, y: 500, vx: 0, vy: 0, kind: 2, bomb: false }
    ]
  }
  // 竖直一刀穿过前两个（x=384 列），远处第三个不中
  const result = slice(state, 384, 400, 384, 700)
  expect(result.cutFruits).toHaveLength(2)
  expect(result.state.score).toBe(2)
  expect(result.state.fruits).toHaveLength(1)
  // 擦边不中：线段离水果中心超过半径 46
  const far = slice({ ...state, fruits: [state.fruits[0]!] }, 384 + 60, 400, 384 + 60, 700)
  expect(far.cutFruits).toHaveLength(0)
})

it('awards multi-fruit bonus and reports bombs for time penalties', () => {
  const state = {
    ...newGame(0),
    fruits: [
      { x: 300, y: 500, vx: 0, vy: 0, kind: 0, bomb: false },
      { x: 400, y: 500, vx: 0, vy: 0, kind: 1, bomb: false },
      { x: 500, y: 500, vx: 0, vy: 0, kind: 2, bomb: false },
      { x: 600, y: 500, vx: 0, vy: 0, kind: 3, bomb: true }
    ]
  }
  const result = slice(state, 200, 500, 640, 500)
  expect(result.cutFruits).toHaveLength(4)
  expect(result.bombs).toBe(1)
  expect(result.bonus).toBe(3)
  expect(result.state.score).toBe(6)
  expect(result.state.cut).toBe(3)
})

it('counts a continuous swipe across multiple input events and rewards only once', () => {
  let state = { ...newGame(0), fruits: [150,300,450,600].map(x => ({x,y:500,vx:0,vy:0,kind:0,bomb:false})) }
  for (let i=0;i<4;i++) state = slice(state,100+i*150,500,175+i*150,500).state
  expect(state.cut).toBe(4)
  expect(state.score).toBe(7)
  expect(state.swipeCount).toBe(4)
  const reset = endSwipe(state)
  expect(reset.swipeCount).toBe(0)
  expect(state.swipeCount).toBe(4)
  expect(reset.score).toBe(7)
})

it('does not combine separate gestures or treat taps and invalid coordinates as slices', () => {
  const state = { ...newGame(0), fruits: [150,300,450].map(x => ({x,y:500,vx:0,vy:0,kind:0,bomb:false})) }
  expect(slice(state,150,500,150,500).state).toBe(state)
  expect(slice(state,NaN,500,450,500).state).toBe(state)
  let next = state
  for (let i=0;i<3;i++) next = endSwipe(slice(next,100+i*150,500,175+i*150,500).state)
  expect(next.score).toBe(3)
})
