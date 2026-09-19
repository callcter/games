export interface PlayAreaOptions {
  top?: number
  bottom?: number
  horizontalPadding?: number
}

export interface PlayAreaMetrics {
  viewportWidth: number
  viewportHeight: number
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
  centerX: number
  centerY: number
  /**
   * 这里描述的是逻辑画布纵横比，不猜设备型号。
   * 390×844 手机在 mountPuzzle 中约为 768×1662，因此会命中。
   * 768×1024 iPad 不命中。
   */
  phoneLike: boolean
}

export interface SquareFitOptions {
  maxSide: number
  top?: number
  bottom?: number
  minSide?: number
}

export interface SquareFit {
  side: number
  left: number
  top: number
  centerX: number
  centerY: number
}

/**
 * PuzzleScene 内容层可用区域。
 *
 * Chrome 不属于这里。v5-A 的四款游戏直接使用动态逻辑画布高度，
 * 不再把旧 768×900 内容整体向下平移。
 */
export function measurePlayArea(
  viewportWidth: number,
  viewportHeight: number,
  options: PlayAreaOptions = {}
): PlayAreaMetrics {
  const horizontalPadding = options.horizontalPadding ?? 48
  const top = options.top ?? (viewportHeight >= 1180 ? 214 : 184)
  const bottomInset = options.bottom ?? (viewportHeight >= 1180 ? 86 : 58)

  const left = horizontalPadding
  const right = Math.max(left, viewportWidth - horizontalPadding)
  const bottom = Math.max(top, viewportHeight - bottomInset)

  return {
    viewportWidth,
    viewportHeight,
    left,
    right,
    top,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    phoneLike: viewportHeight / Math.max(1, viewportWidth) >= 1.72
  }
}

export function fitSquare(
  area: PlayAreaMetrics,
  options: SquareFitOptions
): SquareFit {
  const top = options.top ?? area.top
  const bottom = options.bottom ?? area.bottom
  const minSide = options.minSide ?? 0
  const capacity = Math.floor(
    Math.min(options.maxSide, area.width, Math.max(0, bottom - top))
  )
  const side = capacity >= minSide ? capacity : Math.max(0, capacity)

  return {
    side,
    left: area.centerX - side / 2,
    top: top + Math.max(0, (bottom - top - side) / 2),
    centerX: area.centerX,
    centerY: top + Math.max(0, (bottom - top) / 2)
  }
}

export function legacyVerticalOffset(viewportHeight: number): number {
  return clamp(Math.round((viewportHeight - 900) * 0.47), 0, 360)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
