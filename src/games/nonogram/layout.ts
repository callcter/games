import { legacyVerticalOffset, type PlayAreaMetrics } from '../puzzle-kit/play-area'

export interface NonogramLayout {
  instructionY: number
  modeY: number
  footerY: number
  clueWidth: number
  clueHeight: number
  boardLeft: number
  boardTop: number
  boardSide: number
  cell: number
  rowClueX: number
  columnClueY: number
  rowClueFont: number
  columnClueFont: number
}

export function nonogramLayout(
  area: PlayAreaMetrics,
  size: number
): NonogramLayout {
  if (!area.phoneLike) {
    const offset = legacyVerticalOffset(area.viewportHeight)
    const cell = size === 5 ? 84 : 52
    const boardLeft = size === 5 ? 225 : 200
    const boardTop = (size === 5 ? 310 : 230) + offset
    const clueWidth = size === 5 ? 84 : 108
    const clueHeight = size === 5 ? 84 : 68
    return {
      instructionY: (size === 5 ? 157 : 137) + offset,
      modeY: 780 + offset,
      footerY: 850 + offset,
      clueWidth,
      clueHeight,
      boardLeft,
      boardTop,
      boardSide: cell * size,
      cell,
      rowClueX: boardLeft - (size === 5 ? 44 : 55),
      columnClueY: boardTop - (size === 5 ? 44 : 38),
      rowClueFont: size === 5 ? 25 : 16,
      columnClueFont: size === 5 ? 24 : 15
    }
  }

  const instructionY = area.top + 10
  const footerY = area.bottom - 34
  // v5-C 的手机按钮至少 44 CSS px；两排控制中心距不能再只有 78 logical。
  const modeY = footerY - 110
  const boardRegionTop = instructionY + 58
  const boardRegionBottom = modeY - 96

  const clueWidth = size === 5 ? 92 : 112
  const clueHeight = size === 5 ? 86 : 78
  const targetSide = area.phoneLike
    ? (size === 5 ? 610 : 600)
    : (size === 5 ? 520 : 560)

  const maxByWidth = area.width - clueWidth - 8
  const maxByHeight = boardRegionBottom - boardRegionTop - clueHeight
  const rawSide = Math.max(
    size * 36,
    Math.min(targetSide, maxByWidth, maxByHeight)
  )
  const cell = Math.max(36, Math.floor(rawSide / size))
  const boardSide = cell * size

  const totalWidth = clueWidth + boardSide
  const wholeLeft = area.centerX - totalWidth / 2
  const boardLeft = wholeLeft + clueWidth

  const totalHeight = clueHeight + boardSide
  const boardTop = boardRegionTop + clueHeight +
    Math.max(0, (boardRegionBottom - boardRegionTop - totalHeight) / 2)

  return {
    instructionY,
    modeY,
    footerY,
    clueWidth,
    clueHeight,
    boardLeft,
    boardTop,
    boardSide,
    cell,
    rowClueX: boardLeft - clueWidth / 2,
    columnClueY: boardTop - clueHeight / 2,
    rowClueFont: size === 5 ? 26 : area.phoneLike ? 20 : 17,
    columnClueFont: size === 5 ? 25 : area.phoneLike ? 19 : 16
  }
}
