import { legacyVerticalOffset, type PlayAreaMetrics } from '../puzzle-kit/play-area'

export interface SudokuLayout {
  modeY: number
  digitY: number
  footerY: number
  boardLeft: number
  boardTop: number
  boardSide: number
  cell: number
  digitStep: number
}

export function sudokuLayout(area: PlayAreaMetrics, size: number): SudokuLayout {
  if (!area.phoneLike) {
    const offset = legacyVerticalOffset(area.viewportHeight)
    const cell = Math.min(96, 505 / size)
    const boardSide = cell * size
    return {
      modeY: 165 + offset,
      digitY: 780 + offset,
      footerY: 855 + offset,
      boardLeft: (768 - boardSide) / 2,
      boardTop: 225 + (505 - boardSide) / 2 + offset,
      boardSide,
      cell,
      digitStep: Math.min(80, 690 / size)
    }
  }

  const modeY = area.top + 30
  const footerY = area.bottom - 32
  const digitY = footerY - 92

  const boardRegionTop = modeY + 78
  const boardRegionBottom = digitY - 82
  const targetSide = size === 6 ? 660 : 657
  const maxSide = Math.min(
    targetSide,
    area.width,
    Math.max(0, boardRegionBottom - boardRegionTop)
  )
  const cell = Math.max(54, Math.floor(maxSide / size))
  const boardSide = cell * size
  const boardLeft = area.centerX - boardSide / 2
  const boardTop = boardRegionTop + Math.max(
    0,
    (boardRegionBottom - boardRegionTop - boardSide) / 2
  )

  return {
    modeY,
    digitY,
    footerY,
    boardLeft,
    boardTop,
    boardSide,
    cell,
    digitStep: Math.min(82, 690 / size)
  }
}
