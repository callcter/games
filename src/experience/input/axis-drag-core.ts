// 轴向拖动的纯计算部分：不依赖 Phaser，可在 Node 单测环境直接运行。

/** 一个合法停靠点：core 逻辑格 + 对应像素位置。 */
export interface DragStop {
  logical: number
  pixel: number
}

/** 合法停靠点张成的连续可拖像素范围；无停靠点时返回 null。 */
export function dragExtent(stops: readonly DragStop[]): { min: number; max: number } | null {
  if (!stops.length) return null
  let min = stops[0]!.pixel, max = min
  for (const stop of stops) {
    if (stop.pixel < min) min = stop.pixel
    if (stop.pixel > max) max = stop.pixel
  }
  return { min, max }
}

/** 橡皮筋钳制：范围内自由；越界部分按 1/4 衰减跟进，最多超出 rubber 像素。 */
export function clampWithRubberBand(value: number, min: number, max: number, rubber: number): number {
  if (value < min) return Math.max(min - rubber, min + (value - min) * 0.25)
  if (value > max) return Math.min(max + rubber, max + (value - max) * 0.25)
  return value
}

/** 离 position 最近的合法停靠点；并列时取先出现的。 */
export function nearestStop(position: number, stops: readonly DragStop[]): DragStop | null {
  let best: DragStop | null = null
  let bestDistance = Infinity
  for (const stop of stops) {
    const distance = Math.abs(stop.pixel - position)
    if (distance < bestDistance) {
      best = stop
      bestDistance = distance
    }
  }
  return best
}

/** 相对可拖边缘的阻挡方向：-1 顶到下界，1 顶到上界，0 在范围内。 */
export function blockedDirection(position: number, min: number, max: number): -1 | 0 | 1 {
  if (position <= min) return -1
  if (position >= max) return 1
  return 0
}
