import { fitSquare, legacyVerticalOffset, type PlayAreaMetrics } from '../puzzle-kit/play-area'

export interface MazeLayout {
  modeY: number
  directionY: number
  footerY: number
  boardLeft: number
  boardTop: number
  boardSide: number
  cell: number
}

export function mazeLayout(area: PlayAreaMetrics, size: number): MazeLayout {
  if (!area.phoneLike) {
    const offset = legacyVerticalOffset(area.viewportHeight)
    return {
      modeY: 165 + offset,
      directionY: 775 + offset,
      footerY: 850 + offset,
      boardLeft: 134,
      boardTop: 230 + offset,
      boardSide: 500,
      cell: 500 / size
    }
  }

  const modeY = area.top + 30
  const footerY = area.bottom - 32
  const directionY = footerY - 96
  const fit = fitSquare(area, {
    maxSide: 684,
    top: modeY + 82,
    bottom: directionY - 74,
    minSide: 560
  })

  return {
    modeY,
    directionY,
    footerY,
    boardLeft: fit.left,
    boardTop: fit.top,
    boardSide: fit.side,
    cell: fit.side / size
  }
}
