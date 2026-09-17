import Phaser from 'phaser'

export interface FloatingTextOptions {
  x: number
  y: number
  text: string
  color?: string
  fontSize?: number
  /** 上浮距离，默认 46px。 */
  rise?: number
  /** 存活时长，默认 700ms。 */
  durationMs?: number
  depth?: number
  stroke?: string
}

/** 短生命周期浮字（+分 / 连锁提示）。自毁；Scene 销毁时随场景清理，不留 timer。 */
export function showFloatingText(scene: Phaser.Scene, options: FloatingTextOptions): Phaser.GameObjects.Text {
  const {
    x, y, text, color = '#fffdf6', fontSize = 26, rise = 46, durationMs = 700,
    depth = 2000, stroke = '#3b3226'
  } = options
  const label = scene.add.text(x, y, text, {
    color, fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: `${fontSize}px`, fontStyle: 'bold', stroke, strokeThickness: 4
  }).setOrigin(0.5).setDepth(depth)
  label.setScale(0.7)
  scene.tweens.chain({
    targets: label,
    tweens: [
      { scale: 1, duration: durationMs * 0.3, ease: 'Back.Out' },
      { y: y - rise, alpha: 0, duration: durationMs * 0.7, ease: 'Cubic.Out' }
    ],
    onComplete: () => label.destroy()
  })
  return label
}
