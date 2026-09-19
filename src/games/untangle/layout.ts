import { legacyVerticalOffset, type PlayAreaMetrics } from '../puzzle-kit/play-area'

export interface UntangleLayout {
  modeY: number
  footerY: number
  scale: number
  coreCenterX: number
  coreCenterY: number
  displayCenterX: number
  displayCenterY: number
}

export interface UntanglePoint {
  x: number
  y: number
}

const CORE_CENTER_X = 384
const CORE_CENTER_Y = 485

export function untangleLayout(area: PlayAreaMetrics): UntangleLayout {
  if (!area.phoneLike) {
    const offset = legacyVerticalOffset(area.viewportHeight)
    return {
      modeY: 165 + offset,
      footerY: 850 + offset,
      scale: 1,
      coreCenterX: CORE_CENTER_X,
      coreCenterY: CORE_CENTER_Y,
      displayCenterX: CORE_CENTER_X,
      displayCenterY: CORE_CENTER_Y + offset
    }
  }

  const modeY = area.top + 30
  const footerY = area.bottom - 32
  const fieldTop = modeY + 84
  const fieldBottom = footerY - 86

  // core 中合法 x 范围 70..698，宽 628；用统一缩放避免改变交叉判定几何。
  const scale = Math.min(1.095, area.width / 628)

  return {
    modeY,
    footerY,
    scale,
    coreCenterX: CORE_CENTER_X,
    coreCenterY: CORE_CENTER_Y,
    displayCenterX: area.centerX,
    displayCenterY: (fieldTop + fieldBottom) / 2
  }
}

export function untangleToDisplay(layout: UntangleLayout, point: UntanglePoint): UntanglePoint {
  return {
    x: layout.displayCenterX + (point.x - layout.coreCenterX) * layout.scale,
    y: layout.displayCenterY + (point.y - layout.coreCenterY) * layout.scale
  }
}

export function untangleToCore(layout: UntangleLayout, point: UntanglePoint): UntanglePoint {
  return {
    x: layout.coreCenterX + (point.x - layout.displayCenterX) / layout.scale,
    y: layout.coreCenterY + (point.y - layout.displayCenterY) / layout.scale
  }
}
