import type { PlayAreaMetrics } from '../puzzle-kit/play-area'
import { clamp, legacyVerticalOffset } from '../puzzle-kit/play-area'

export interface MemoryLayout {
  modeY: number
  footerY: number
  cols: number
  rows: number
  cell: number
  step: number
  centerY: number
}

export function memoryLayout(
  area: PlayAreaMetrics,
  pairs: number,
  cardCount: number
): MemoryLayout {
  const cols = area.phoneLike
    ? (pairs === 24 ? 6 : 4)
    : (pairs === 12 ? 6 : 8)
  const rows = cardCount / cols

  // 非手机视口完全复现 v4：尺寸不变，只把原先 contentOffsetY 烘进布局。
  if (!area.phoneLike) {
    const offset = legacyVerticalOffset(area.viewportHeight)
    const cell = Math.min(148, 570 / cols, 450 / rows)
    return {
      modeY: 165 + offset,
      footerY: 850 + offset,
      cols,
      rows,
      cell,
      step: cell + 12,
      centerY: 490 + offset
    }
  }

  const modeY = area.top + 30
  const footerY = area.bottom - 32

  const gridTop = modeY + 80
  const gridBottom = footerY - 82
  const maxStep = 160
  const step = Math.max(
    44,
    Math.floor(Math.min(area.width / cols, (gridBottom - gridTop) / rows, maxStep))
  )
  const gap = clamp(Math.round(step * 0.075), 8, 12)
  const cell = Math.max(36, step - gap)

  return {
    modeY,
    footerY,
    cols,
    rows,
    cell,
    step,
    centerY: (gridTop + gridBottom) / 2
  }
}
