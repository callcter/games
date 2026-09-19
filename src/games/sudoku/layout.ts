import { legacyVerticalOffset, type PlayAreaMetrics } from '../puzzle-kit/play-area'

export interface SudokuLayout {
  modeY: number
  digitY: number
  digitColumns: number
  digitRowGap: number
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
      digitColumns: size,
      digitRowGap: 0,
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
  const digitColumns = size === 9 ? 5 : size
  const digitRowGap = size === 9 ? 100 : 0
  const digitY = size === 9 ? footerY - 210 : footerY - 110

  const boardRegionTop = modeY + 78
  const boardRegionBottom = digitY - 72
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
    digitColumns,
    digitRowGap,
    footerY,
    boardLeft,
    boardTop,
    boardSide,
    cell,
    digitStep: size === 9
      ? 126
      : Math.min(112, 690 / size)
  }
}
