import { describe, expect, it } from 'vitest'
import { blockedDirection, clampWithRubberBand, dragExtent, nearestStop, shouldCommitStop, type DragStop } from '../../src/experience/input/axis-drag-core'

const stops = (pixels: number[]): DragStop[] => pixels.map((pixel, index) => ({ logical: index, pixel }))

describe('dragExtent', () => {
  it('无停靠点时没有可拖范围', () => {
    expect(dragExtent([])).toBeNull()
  })

  it('取所有停靠点的最小与最大像素', () => {
    expect(dragExtent(stops([100, 200, 300]))).toEqual({ min: 100, max: 300 })
    expect(dragExtent(stops([300, 100]))).toEqual({ min: 100, max: 300 })
  })

  it('单个停靠点范围退化为一点', () => {
    expect(dragExtent(stops([150]))).toEqual({ min: 150, max: 150 })
  })
})

describe('clampWithRubberBand', () => {
  it('范围内原样通过', () => {
    expect(clampWithRubberBand(150, 100, 300, 8)).toBe(150)
    expect(clampWithRubberBand(100, 100, 300, 8)).toBe(100)
    expect(clampWithRubberBand(300, 100, 300, 8)).toBe(300)
  })

  it('越界部分按 1/4 衰减跟进', () => {
    // 越界 20px → 视觉只跟 5px（未触 rubber 封顶）
    expect(clampWithRubberBand(80, 100, 300, 8)).toBe(95)
    expect(clampWithRubberBand(320, 100, 300, 8)).toBe(305)
  })

  it('超出量被封顶在 rubber 像素', () => {
    expect(clampWithRubberBand(0, 100, 300, 8)).toBe(92)
    expect(clampWithRubberBand(1000, 100, 300, 8)).toBe(308)
  })

  it('rubber 为 0 时是硬钳制', () => {
    expect(clampWithRubberBand(60, 100, 300, 0)).toBe(100)
    expect(clampWithRubberBand(340, 100, 300, 0)).toBe(300)
  })
})

describe('nearestStop', () => {
  it('返回距离最近的停靠点', () => {
    const list = stops([100, 200, 300])
    expect(nearestStop(145, list)?.pixel).toBe(100)
    expect(nearestStop(155, list)?.pixel).toBe(200)
    expect(nearestStop(260, list)?.pixel).toBe(300)
  })

  it('并列时取先出现的停靠点', () => {
    const list = stops([100, 200])
    expect(nearestStop(150, list)?.pixel).toBe(100)
  })

  it('无停靠点返回 null', () => {
    expect(nearestStop(150, [])).toBeNull()
  })
})

describe('blockedDirection', () => {
  it('下界/范围内/上界分别返回 -1/0/1', () => {
    expect(blockedDirection(95, 100, 300)).toBe(-1)
    expect(blockedDirection(100, 100, 300)).toBe(-1)
    expect(blockedDirection(150, 100, 300)).toBe(0)
    expect(blockedDirection(300, 100, 300)).toBe(1)
    expect(blockedDirection(310, 100, 300)).toBe(1)
  })
})

describe('shouldCommitStop', () => {
  const side = stops([100, 200, 300])

  it('静止/轻扫（位移未过半程）返回 null', () => {
    expect(shouldCommitStop(294, 294, side)).toBeNull()   // 原地不动（横车竖拖的场景）
    expect(shouldCommitStop(248, 294, side)).toBeNull()   // 只拖了 46px，未到 200 的一半距离
  })

  it('拖过半程提交最近停靠点', () => {
    expect(shouldCommitStop(202, 294, side)?.pixel).toBe(200)
    expect(shouldCommitStop(150, 294, side)?.pixel).toBe(100)
    expect(shouldCommitStop(100, 294, side)?.pixel).toBe(100)
  })

  it('无停靠点返回 null', () => {
    expect(shouldCommitStop(294, 294, [])).toBeNull()
  })
})
