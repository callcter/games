import { describe, expect, it } from 'vitest'
import { measurePlayArea } from '../../src/games/puzzle-kit/play-area'
import { mazeLayout } from '../../src/games/maze/layout'
import { sudokuLayout } from '../../src/games/sudoku/layout'
import { tangramLayout, tangramToCore, tangramToDisplay } from '../../src/games/tangram/layout'
import { untangleLayout, untangleToCore, untangleToDisplay } from '../../src/games/untangle/layout'

describe('responsive puzzle play area v5-B', () => {
  it('grows Maze to the phone width while keeping all controls separated', () => {
    const area = measurePlayArea(768, 1662, { bottom: 78, horizontalPadding: 42 })
    const layout = mazeLayout(area, 11)

    expect(area.phoneLike).toBe(true)
    expect(layout.boardSide).toBe(684)
    expect(layout.boardLeft).toBe(42)
    expect(layout.cell).toBeGreaterThan(62)
    expect(layout.boardTop + layout.boardSide).toBeLessThan(layout.directionY)
    expect(layout.directionY).toBeLessThan(layout.footerY)
  })

  it('uses nearly the full phone width for both Sudoku densities', () => {
    const area = measurePlayArea(768, 1662, { bottom: 78, horizontalPadding: 36 })
    const six = sudokuLayout(area, 6)
    const nine = sudokuLayout(area, 9)

    expect(six.boardSide).toBe(660)
    expect(six.cell).toBe(110)
    expect(nine.boardSide).toBe(657)
    expect(nine.cell).toBe(73)
    expect(six.boardTop + six.boardSide).toBeLessThan(six.digitY)
    expect(nine.boardTop + nine.boardSide).toBeLessThan(nine.digitY)
  })

  it('keeps Tangram view mapping invertible', () => {
    const area = measurePlayArea(768, 1662, { bottom: 78, horizontalPadding: 40 })
    const layout = tangramLayout(area)
    const core = { x: 612, y: 718 }
    const display = tangramToDisplay(layout, core)
    const restored = tangramToCore(layout, display)

    expect(layout.scale).toBeGreaterThan(1.1)
    expect(restored.x).toBeCloseTo(core.x, 8)
    expect(restored.y).toBeCloseTo(core.y, 8)
    expect(layout.boardX).toBeGreaterThanOrEqual(area.left)
    expect(layout.boardX + layout.boardWidth).toBeLessThanOrEqual(area.right)
  })

  it('keeps Untangle view mapping invertible and inside the phone stage', () => {
    const area = measurePlayArea(768, 1662, { bottom: 78, horizontalPadding: 40 })
    const layout = untangleLayout(area)
    const core = { x: 70, y: 745 }
    const display = untangleToDisplay(layout, core)
    const restored = untangleToCore(layout, display)

    expect(layout.scale).toBeCloseTo(1.095, 6)
    expect(display.x).toBeGreaterThanOrEqual(area.left)
    expect(display.x).toBeLessThanOrEqual(area.right)
    expect(restored.x).toBeCloseTo(core.x, 8)
    expect(restored.y).toBeCloseTo(core.y, 8)
  })

  it('reproduces v4 final scene coordinates on iPad portrait', () => {
    const mazeArea = measurePlayArea(768, 1024, { bottom: 78, horizontalPadding: 42 })
    const maze = mazeLayout(mazeArea, 7)
    expect(maze.modeY).toBe(223)
    expect(maze.boardTop).toBe(288)
    expect(maze.boardSide).toBe(500)
    expect(maze.footerY).toBe(908)

    const sudokuArea = measurePlayArea(768, 1024, { bottom: 78, horizontalPadding: 36 })
    const sudoku = sudokuLayout(sudokuArea, 9)
    expect(sudoku.modeY).toBe(223)
    expect(sudoku.boardTop).toBe(283)
    expect(sudoku.boardSide).toBe(505)
    expect(sudoku.footerY).toBe(913)

    const tangramArea = measurePlayArea(768, 1024, { bottom: 78, horizontalPadding: 40 })
    const tangram = tangramLayout(tangramArea)
    expect(tangram.scale).toBe(1)
    expect(tangram.actionY).toBe(268)
    expect(tangram.boardY).toBe(304)
    expect(tangram.footerY).toBe(908)

    const untangleArea = measurePlayArea(768, 1024, { bottom: 78, horizontalPadding: 40 })
    const untangle = untangleLayout(untangleArea)
    expect(untangle.scale).toBe(1)
    expect(untangle.modeY).toBe(223)
    expect(untangle.displayCenterY).toBe(543)
    expect(untangle.footerY).toBe(908)
  })
})
