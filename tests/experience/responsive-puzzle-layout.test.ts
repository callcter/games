import { describe, expect, it } from 'vitest'
import { measurePlayArea } from '../../src/games/puzzle-kit/play-area'
import { memoryLayout } from '../../src/games/memory/layout'
import { pipesLayout } from '../../src/games/pipes/layout'
import { sokobanLevelLayout, sokobanPlayLayout } from '../../src/games/sokoban/layout'
import { nonogramLayout } from '../../src/games/nonogram/layout'

describe('responsive puzzle play area v5-A', () => {
  it('uses a phone-specific composition on 390x844-equivalent logical height', () => {
    const memoryArea = measurePlayArea(768, 1662, { bottom: 84, horizontalPadding: 40 })
    expect(memoryArea.phoneLike).toBe(true)

    const twelve = memoryLayout(memoryArea, 12, 24)
    expect(twelve.cols).toBe(4)
    expect(twelve.rows).toBe(6)
    expect(twelve.cell).toBeGreaterThanOrEqual(140)

    const twentyFour = memoryLayout(memoryArea, 24, 48)
    expect(twentyFour.cols).toBe(6)
    expect(twentyFour.rows).toBe(8)
    expect(twentyFour.cell).toBeGreaterThanOrEqual(100)
    expect(twentyFour.footerY).toBeGreaterThan(1500)
  })

  it('lets Pipes use the phone width instead of the retired 570px board', () => {
    const area = measurePlayArea(768, 1662, { bottom: 84, horizontalPadding: 54 })
    const layout = pipesLayout(area, 4)
    expect(layout.boardSide).toBe(660)
    expect(layout.cell).toBe(165)
    expect(layout.boardLeft).toBe(54)
    expect(layout.boardTop + layout.boardSide).toBeLessThan(layout.footerY - 60)
  })

  it('grows Sokoban while keeping the board inside the control rows', () => {
    const area = measurePlayArea(768, 1662, { bottom: 76, horizontalPadding: 40 })
    const play = sokobanPlayLayout(area, 8, 7)
    expect(play.cell).toBeGreaterThanOrEqual(84)
    expect(play.boardLeft).toBeGreaterThanOrEqual(area.left)
    expect(play.boardTop + play.boardHeight).toBeLessThan(play.directionY)

    const levels = sokobanLevelLayout(area, 30)
    expect(levels.cols).toBe(4)
    expect(levels.rows).toBe(8)
    expect(levels.buttonWidth).toBeGreaterThanOrEqual(140)
  })

  it('makes both Nonogram densities substantially larger on phone', () => {
    const area = measurePlayArea(768, 1662, { bottom: 78, horizontalPadding: 28 })
    const small = nonogramLayout(area, 5)
    const large = nonogramLayout(area, 10)

    expect(small.boardSide).toBeGreaterThanOrEqual(600)
    expect(small.cell).toBeGreaterThanOrEqual(120)
    expect(large.boardSide).toBeGreaterThanOrEqual(580)
    expect(large.cell).toBeGreaterThanOrEqual(58)
    expect(small.boardTop + small.boardSide).toBeLessThan(small.modeY)
    expect(large.boardTop + large.boardSide).toBeLessThan(large.modeY)
  })

  it('reproduces the v4 geometry on non-phone viewports', () => {
    const memoryArea = measurePlayArea(768, 1024, { bottom: 84, horizontalPadding: 40 })
    expect(memoryArea.phoneLike).toBe(false)
    const memory = memoryLayout(memoryArea, 12, 24)
    expect(memory.cols).toBe(6)
    expect(memory.cell).toBe(95)
    expect(memory.modeY).toBe(223)
    expect(memory.centerY).toBe(548)

    const pipesArea = measurePlayArea(768, 1024, { bottom: 84, horizontalPadding: 54 })
    const pipes = pipesLayout(pipesArea, 4)
    expect(pipes.boardSide).toBe(570)
    expect(pipes.boardTop).toBe(298)

    const nonogramArea = measurePlayArea(768, 1024, { bottom: 78, horizontalPadding: 28 })
    expect(nonogramLayout(nonogramArea, 5).boardSide).toBe(420)
    expect(nonogramLayout(nonogramArea, 10).boardSide).toBe(520)
  })
})
