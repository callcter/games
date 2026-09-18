import Phaser from 'phaser'
import { GAME_UI, GAME_UI_FONT } from '../tokens'

export interface GameToast {
  container: Phaser.GameObjects.Container
  close(): void
}

export interface ToastOptions {
  x: number
  y: number
  message: string
  timeout?: number
  width?: number
}

export function showGameToast(scene: Phaser.Scene, options: ToastOptions): GameToast {
  const width = options.width ?? 420
  const timeout = options.timeout ?? 1600

  const container = scene.add.container(options.x, options.y).setDepth(GAME_UI.depth.toast)
  const shadow = scene.add.graphics()
  shadow.fillStyle(GAME_UI.colors.cocoa, 0.22)
  shadow.fillRoundedRect(-width / 2, -25 + 6, width, 54, 27)

  const face = scene.add.graphics()
  face.fillStyle(GAME_UI.colors.forest, 0.96)
  face.fillRoundedRect(-width / 2, -27, width, 54, 27)

  const text = scene.add.text(0, 0, options.message, {
    fontFamily: GAME_UI_FONT,
    fontSize: '17px',
    color: '#fffdf6',
    fontStyle: 'bold',
    align: 'center'
  }).setOrigin(0.5)

  container.add([shadow, face, text])
  container.setAlpha(0).setScale(0.94)

  scene.tweens.add({
    targets: container,
    alpha: 1,
    scale: 1,
    duration: GAME_UI.motion.toastMs,
    ease: 'Back.Out'
  })

  let closed = false
  const close = (): void => {
    if (closed) return
    closed = true
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: options.y - 8,
      duration: 170,
      onComplete: () => container.destroy(true)
    })
  }

  if (timeout > 0) {
    scene.time.delayedCall(timeout, close)
  }

  return { container, close }
}
