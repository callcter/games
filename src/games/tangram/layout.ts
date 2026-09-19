import { legacyVerticalOffset, type PlayAreaMetrics } from '../puzzle-kit/play-area'

export interface TangramLayout {
  actionY: number
  footerY: number
  scale: number
  coreCenterX: number
  coreCenterY: number
  displayCenterX: number
  displayCenterY: number
  boardX: number
  boardY: number
  boardWidth: number
  boardHeight: number
}

export interface TangramPoint {
  x: number
  y: number
}

const CORE_CENTER_X = 384
const CORE_CENTER_Y = 540

export function tangramLayout(area: PlayAreaMetrics): TangramLayout {
  if (!area.phoneLike) {
    const offset = legacyVerticalOffset(area.viewportHeight)
    return {
      actionY: 210 + offset,
      footerY: 850 + offset,
      scale: 1,
      coreCenterX: CORE_CENTER_X,
      coreCenterY: CORE_CENTER_Y,
      displayCenterX: CORE_CENTER_X,
      displayCenterY: CORE_CENTER_Y + offset,
      boardX: 82,
      boardY: 246 + offset,
      boardWidth: 604,
      boardHeight: 424
    }
  }

  const actionY = area.top + 42
  const footerY = area.bottom - 32
  const stageTop = actionY + 78
  const stageBottom = footerY - 74
  const scale = Math.min(1.12, area.width / 620)
  const displayCenterY = (stageTop + stageBottom) / 2 - 10

  return {
    actionY,
    footerY,
    scale,
    coreCenterX: CORE_CENTER_X,
    coreCenterY: CORE_CENTER_Y,
    displayCenterX: area.centerX,
    displayCenterY,
    boardX: area.centerX + (82 - CORE_CENTER_X) * scale,
    boardY: displayCenterY + (246 - CORE_CENTER_Y) * scale,
    boardWidth: 604 * scale,
    boardHeight: 424 * scale
  }
}

export function tangramToDisplay(layout: TangramLayout, point: TangramPoint): TangramPoint {
  return {
    x: layout.displayCenterX + (point.x - layout.coreCenterX) * layout.scale,
    y: layout.displayCenterY + (point.y - layout.coreCenterY) * layout.scale
  }
}

export function tangramToCore(layout: TangramLayout, point: TangramPoint): TangramPoint {
  return {
    x: layout.coreCenterX + (point.x - layout.displayCenterX) / layout.scale,
    y: layout.coreCenterY + (point.y - layout.displayCenterY) / layout.scale
  }
}
