import { describe, expect, it } from 'vitest'
import { measurePhysicalMetrics } from '../../src/games/puzzle-kit/physical-metrics'
import { measurePlayArea } from '../../src/games/puzzle-kit/play-area'
import { nonogramLayout } from '../../src/games/nonogram/layout'
import { sudokuLayout } from '../../src/games/sudoku/layout'

describe('v5-C physical metrics', () => {
  it('maps phone controls to real CSS-sized touch targets', () => {
    const metrics = measurePhysicalMetrics(768, 390)

    expect(metrics.cssScale).toBeCloseTo(390 / 768, 8)
    expect(metrics.cssForLogical(60)).toBeCloseTo(30.46875, 6)

    const touch = metrics.atLeastCss(60, 44)
    const font = metrics.atLeastCss(21, 15)

    expect(touch).toBeCloseTo(86.646153846, 6)
    expect(font).toBeCloseTo(29.538461538, 6)
    expect(metrics.cssForLogical(touch)).toBeCloseTo(44, 8)
    expect(metrics.cssForLogical(font)).toBeCloseTo(15, 8)
  })

  it('does not enlarge existing iPad logical sizes', () => {
    const metrics = measurePhysicalMetrics(768, 768)
    expect(metrics.atLeastCss(60, 44)).toBe(60)
    expect(metrics.atLeastCss(21, 15)).toBe(21)
  })

  it('keeps the two Nonogram control rows separated after 44px buttons', () => {
    const area = measurePlayArea(768, 1662, { bottom: 78, horizontalPadding: 28 })

    for (const size of [5, 10]) {
      const layout = nonogramLayout(area, size)
      expect(layout.footerY - layout.modeY).toBe(110)
      expect(layout.boardTop + layout.boardSide).toBeLessThan(layout.modeY - 40)
    }

    expect(nonogramLayout(area, 5).boardSide).toBe(610)
    expect(nonogramLayout(area, 10).boardSide).toBe(590)
  })

  it('uses a 5+4 phone keypad for 9×9 Sudoku', () => {
    const area = measurePlayArea(768, 1662, { bottom: 78, horizontalPadding: 36 })
    const six = sudokuLayout(area, 6)
    const nine = sudokuLayout(area, 9)

    expect(six.digitColumns).toBe(6)
    expect(six.digitRowGap).toBe(0)

    expect(nine.digitColumns).toBe(5)
    expect(nine.digitRowGap).toBe(100)
    expect(nine.digitStep).toBe(126)
    expect(nine.digitY + nine.digitRowGap).toBe(nine.footerY - 110)
    expect(nine.boardSide).toBe(657)
  })

  it('preserves the old single-row keypad on iPad', () => {
    const area = measurePlayArea(768, 1024, { bottom: 78, horizontalPadding: 36 })
    const nine = sudokuLayout(area, 9)

    expect(area.phoneLike).toBe(false)
    expect(nine.digitColumns).toBe(9)
    expect(nine.digitRowGap).toBe(0)
    expect(nine.digitY).toBe(838)
  })
})
