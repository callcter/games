import Phaser from 'phaser'

/** 体验层统一时间常量（方案 §76：只做默认值，具体游戏可以偏离）。 */
export const EXPERIENCE_TIMING = {
  instant: 80,
  quick: 160,
  normal: 240
} as const

/** 手感参数集中在常量里，Playtest 后只改这里（方案 §59）。 */
export const MOTION_FEEL = {
  pressScale: 0.96,
  pickupScale: 1.035,
  popFrom: 0.82,
  popPeak: 1.1,
  bumpPixels: 8,
  pressMs: 70,
  pickupMs: 110,
  snapMs: 180,
  bumpMs: 140,
  popMs: 200
} as const

type Transform = Phaser.GameObjects.Components.Transform
type Tween = Phaser.Tweens.Tween

// press/pickup 记住对象进入前的基准缩放，release/落回时还原，避免连续按压累计漂移。
const baseScales = new WeakMap<object, { x: number; y: number }>()

function rememberScale(target: Transform): { x: number; y: number } {
  let base = baseScales.get(target)
  if (!base) {
    base = { x: target.scaleX, y: target.scaleY }
    baseScales.set(target, base)
  }
  return base
}

function scaleTo(scene: Phaser.Scene, target: Transform, scale: number, duration: number, ease: string): Tween {
  const base = rememberScale(target)
  return scene.tweens.add({
    targets: target, scaleX: base.x * scale, scaleY: base.y * scale, duration, ease
  })
}

/** 按下：轻微缩小，让对象「被压住」。 */
export function press(scene: Phaser.Scene, target: Transform, scale = MOTION_FEEL.pressScale, duration = MOTION_FEEL.pressMs): Tween {
  return scaleTo(scene, target, scale, duration, 'Sine.Out')
}

/** 拿起：轻微放大 + 呼吸感，不夸张（方案 §6.2：1.00→1.035）。 */
export function pickup(scene: Phaser.Scene, target: Transform, scale = MOTION_FEEL.pickupScale, duration = MOTION_FEEL.pickupMs): Tween {
  return scaleTo(scene, target, scale, duration, 'Sine.Out')
}

/** 释放/落回：回到基准缩放。 */
export function release(scene: Phaser.Scene, target: Transform, duration = MOTION_FEEL.pressMs): Tween {
  const base = baseScales.get(target) ?? { x: target.scaleX, y: target.scaleY }
  return scene.tweens.add({
    targets: target, scaleX: base.x, scaleY: base.y, duration, ease: 'Back.Out'
  })
}

export interface SnapOptions {
  duration?: number
  /** 落定时附带一个轻微回弹，默认开。 */
  settle?: boolean
  ease?: string
  onComplete?: () => void
}

/** 吸附：把对象 tween 到 (x, y)，可选落定回弹。 */
export function snap(scene: Phaser.Scene, target: Transform, x: number, y: number, options: SnapOptions = {}): Tween {
  const { duration = MOTION_FEEL.snapMs, settle = true, ease = 'Cubic.Out', onComplete } = options
  const tween = scene.tweens.add({
    targets: target, x, y, duration, ease,
    onComplete: () => {
      if (settle) release(scene, target, MOTION_FEEL.pressMs)
      onComplete?.()
    }
  })
  return tween
}

/** 阻挡反馈：沿指定轴轻推一下再弹回（方案 §6.2 被挡住的「bumper」感）。 */
export function bump(scene: Phaser.Scene, target: Transform, axis: 'x' | 'y', direction: -1 | 1, pixels = MOTION_FEEL.bumpPixels, duration = MOTION_FEEL.bumpMs): Tween {
  const from = axis === 'x' ? target.x : target.y
  const to = from + direction * pixels
  return scene.tweens.add({
    targets: target, [axis]: to, duration: duration / 2, yoyo: true, ease: 'Sine.Out'
  }) as Tween
}

/** 弹出：缩到 0.82 再弹过基准到峰值回落（方案 §7.2 merge 生成的三段感）。 */
export function pop(scene: Phaser.Scene, target: Transform, peak = MOTION_FEEL.popPeak): void {
  const base = rememberScale(target)
  scene.tweens.chain({
    targets: target,
    tweens: [
      { scaleX: base.x * MOTION_FEEL.popFrom, scaleY: base.y * MOTION_FEEL.popFrom, duration: 40 },
      { scaleX: base.x * peak, scaleY: base.y * peak, duration: MOTION_FEEL.popMs * 0.45, ease: 'Sine.Out' },
      { scaleX: base.x, scaleY: base.y, duration: MOTION_FEEL.popMs * 0.55, ease: 'Sine.InOut' }
    ]
  })
}
