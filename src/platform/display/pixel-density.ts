/** Retina 清晰度上限 2 倍，总画布像素不超过约 4M。逻辑尺寸和触控面积不变。 */
export function pixelDensity(width: number, height: number, deviceRatio: number): number {
  const ratio = Number.isFinite(deviceRatio) ? Math.max(1, deviceRatio) : 1
  return Math.max(1, Math.min(2, ratio, Math.sqrt(4_194_304 / Math.max(1, width * height))))
}
