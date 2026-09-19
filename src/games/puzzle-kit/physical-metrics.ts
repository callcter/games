export interface PhysicalMetrics {
  logicalWidth: number
  cssWidth: number
  cssScale: number
  logicalForCss(cssPx: number): number
  cssForLogical(logicalPx: number): number
  atLeastCss(logicalPx: number, minCssPx: number): number
}

/**
 * Phaser 的游戏逻辑宽度固定为 768，但手机上 Canvas 最终可能只有 390 CSS px。
 *
 * 例：
 *   768 logical -> 390 CSS
 *   cssScale = 0.5078125
 *
 * 因此旧的 60 logical px 按钮实际只有约 30.5 CSS px。
 */
export function measurePhysicalMetrics(
  logicalWidth: number,
  cssWidth: number
): PhysicalMetrics {
  const safeLogical = Number.isFinite(logicalWidth) && logicalWidth > 0 ? logicalWidth : 1
  const safeCss = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : safeLogical
  const cssScale = safeCss / safeLogical

  const logicalForCss = (cssPx: number): number =>
    Math.max(0, cssPx) / cssScale

  return {
    logicalWidth: safeLogical,
    cssWidth: safeCss,
    cssScale,
    logicalForCss,
    cssForLogical(logicalPx: number): number {
      return Math.max(0, logicalPx) * cssScale
    },
    atLeastCss(logicalPx: number, minCssPx: number): number {
      return Math.max(logicalPx, logicalForCss(minCssPx))
    }
  }
}
