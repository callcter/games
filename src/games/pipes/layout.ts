import type { PlayAreaMetrics } from '../puzzle-kit/play-area'
import { fitSquare, legacyVerticalOffset } from '../puzzle-kit/play-area'

export interface PipesLayout {
  modeY: number
  footerY: number
  boardLeft: number
  boardTop: number
  boardSide: number
  cell: number
}

export function pipesLayout(
  area: PlayAreaMetrics,
  size: number
): PipesLayout {
  if (!area.phoneLike) {
    const offset = legacyVerticalOffset(area.viewportHeight)
    return {
      modeY: 165 + offset,
      footerY: 850 + offset,
      boardLeft: 99,
      boardTop: 240 + offset,
      boardSide: 570,
      cell: 570 / size
    }
  }

  const modeY = area.top + 30
  const footerY = area.bottom - 32
  const boardTopLimit = modeY + 82
  const boardBottomLimit = footerY - 84
  const fit = fitSquare(area, {
    maxSide: area.phoneLike ? 660 : 610,
    top: boardTopLimit,
    bottom: boardBottomLimit,
    minSide: 420
  })

  return {
    modeY,
    footerY,
    boardLeft: fit.left,
    boardTop: fit.top,
    boardSide: fit.side,
    cell: fit.side / size
  }
}
