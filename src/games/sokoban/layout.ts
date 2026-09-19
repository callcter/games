import { legacyVerticalOffset, type PlayAreaMetrics } from '../puzzle-kit/play-area'

export interface SokobanPlayLayout {
  instructionY: number
  footerY: number
  directionY: number
  boardLeft: number
  boardTop: number
  boardWidth: number
  boardHeight: number
  cell: number
  nextY: number
}

export interface SokobanLevelLayout {
  instructionY: number
  cols: number
  rows: number
  buttonWidth: number
  rowStep: number
  columnStep: number
  firstX: number
  firstY: number
}

export function sokobanPlayLayout(
  area: PlayAreaMetrics,
  width: number,
  height: number
): SokobanPlayLayout {
  if (!area.phoneLike) {
    const offset = legacyVerticalOffset(area.viewportHeight)
    const cell = Math.min(76, 470 / height, 660 / width)
    const boardWidth = width * cell
    const boardHeight = height * cell
    return {
      instructionY: 165 + offset,
      footerY: 850 + offset,
      directionY: 740 + offset,
      boardLeft: (768 - boardWidth) / 2,
      boardTop: 225 + offset,
      boardWidth,
      boardHeight,
      cell,
      nextY: 700 + offset
    }
  }

  const instructionY = area.top + 18
  const footerY = area.bottom - 32
  const directionY = footerY - 102
  const boardRegionTop = instructionY + 54
  const boardRegionBottom = directionY - 70

  const maxCell = area.phoneLike ? 88 : 80
  const cell = Math.max(
    46,
    Math.floor(Math.min(
      maxCell,
      area.width / width,
      Math.max(0, boardRegionBottom - boardRegionTop) / height
    ))
  )

  const boardWidth = width * cell
  const boardHeight = height * cell
  const boardLeft = area.centerX - boardWidth / 2
  const boardTop = boardRegionTop +
    Math.max(0, (boardRegionBottom - boardRegionTop - boardHeight) / 2)

  return {
    instructionY,
    footerY,
    directionY,
    boardLeft,
    boardTop,
    boardWidth,
    boardHeight,
    cell,
    nextY: Math.min(directionY - 84, boardTop + boardHeight + 62)
  }
}

export function sokobanLevelLayout(
  area: PlayAreaMetrics,
  levelCount: number
): SokobanLevelLayout {
  if (!area.phoneLike) {
    const offset = legacyVerticalOffset(area.viewportHeight)
    return {
      instructionY: 170 + offset,
      cols: 5,
      rows: Math.ceil(levelCount / 5),
      buttonWidth: 108,
      rowStep: 112,
      columnStep: 128,
      firstX: 128,
      firstY: 216 + offset
    }
  }

  const instructionY = area.top + 18
  const cols = area.phoneLike ? 4 : 5
  const rows = Math.ceil(levelCount / cols)
  const columnStep = area.width / cols
  const buttonWidth = Math.floor(Math.min(
    area.phoneLike ? 148 : 112,
    columnStep - 18
  ))

  const gridTop = instructionY + 62
  const availableHeight = Math.max(0, area.bottom - gridTop)
  const rowStep = Math.floor(Math.min(
    area.phoneLike ? 118 : 112,
    (availableHeight - 60) / Math.max(1, rows - 1)
  ))
  const totalHeight = 60 + Math.max(0, rows - 1) * rowStep
  const firstY = gridTop + Math.max(0, (availableHeight - totalHeight) / 2) + 30

  return {
    instructionY,
    cols,
    rows,
    buttonWidth,
    rowStep,
    columnStep,
    firstX: area.left + columnStep / 2,
    firstY
  }
}
