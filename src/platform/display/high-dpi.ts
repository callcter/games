import Phaser from 'phaser'
import { pixelDensity } from './pixel-density'

// Phaser 4 没有 GameConfig.resolution；文字有独立的栅格化分辨率。
const originalText = Phaser.GameObjects.GameObjectFactory.prototype.text
Phaser.GameObjects.GameObjectFactory.prototype.text = function (...args: Parameters<typeof originalText>) {
  const ratio = pixelDensity(this.scene.scale.width, this.scene.scale.height, window.devicePixelRatio)
  args[3] = { resolution: ratio, ...args[3] }
  return originalText.apply(this, args)
}

/** 只放大默认帧缓冲的像素 viewport/scissor，不改相机、世界、ScaleManager 或输入坐标。
 * 离屏纹理仍用自己的尺寸。适用于本项目固定的 Phaser 4.2.1；升级时须做 DPR=2 回归。
 */
export function enableHighDpi(game: Phaser.Game): void {
  if (!(game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return
  const renderer = game.renderer, wrapper = renderer.glWrapper
  const update = wrapper.update
  let ratio = 1
  const scaleBox = (box: number[]): [number, number, number, number] =>
    [Math.round(box[0]! * ratio), Math.round(box[1]! * ratio), Math.round(box[2]! * ratio), Math.round(box[3]! * ratio)]
  wrapper.update = function (state, force, vaoLast) {
    // wrapper.state 已经是物理像素；强制恢复缓存状态时不能再次缩放。
    if (state && state !== this.state) {
      // 4.2.1 的声明把 viewport 误标为 Int32Array[]，源码实际使用 number[4]。
      type PixelState = { bindings?: { framebuffer?: unknown }; viewport?: number[]; scissor?: { box?: number[] } }
      const logical = state as unknown as PixelState
      const cached = this.state as unknown as PixelState
      const framebuffer = logical.bindings?.framebuffer === undefined ? cached.bindings?.framebuffer : logical.bindings.framebuffer
      if (!framebuffer || framebuffer === renderer.baseDrawingContext.framebuffer) {
        state = { ...state,
          ...(logical.viewport ? { viewport: scaleBox(logical.viewport) } : {}),
          ...(logical.scissor?.box ? { scissor: { ...logical.scissor, box: scaleBox(logical.scissor.box) } } : {})
        } as unknown as typeof state
      }
    }
    return update.call(this, state, force, vaoLast)
  }
  const resize = (): void => {
    const { width, height } = game.scale.baseSize
    ratio = pixelDensity(width, height, window.devicePixelRatio)
    const w = Math.round(width * ratio), h = Math.round(height * ratio)
    if (game.canvas.width !== w) game.canvas.width = w
    if (game.canvas.height !== h) game.canvas.height = h
    ;(renderer as unknown as { drawingBufferHeight: number }).drawingBufferHeight = h
  }
  resize()
  game.events.on(Phaser.Core.Events.PRE_RENDER, resize)
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    game.events.off(Phaser.Core.Events.PRE_RENDER, resize)
    wrapper.update = update
  })
}
