import Phaser from 'phaser'
import { createGameUiIcon, gameUiIconTexture, type GameUiIconName } from '../icons'
import { GAME_UI } from '../tokens'

export interface GameIconButton {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setIcon(icon: GameUiIconName): void
  setEnabled(enabled: boolean): void
}

export interface IconButtonOptions {
  radius?: number
  depth?: number
}

/**
 * 全局唯一的圆形应用级按钮：
 * 返回 / 声音 / 设置 / 关闭类操作全部使用它。
 */
export function createIconButton(
  scene: Phaser.Scene,
  icon: GameUiIconName,
  action: () => void,
  options: IconButtonOptions = {}
): GameIconButton {
  const radius = options.radius ?? GAME_UI.radius.iconButton
  const depth = options.depth ?? GAME_UI.depth.chrome

  const container = scene.add.container(0, 0).setDepth(depth)
  const shadow = scene.add.graphics()
  const rim = scene.add.graphics()
  const face = scene.add.graphics()
  const glyph = createGameUiIcon(
    scene,
    icon,
    GAME_UI.size.iconGlyph,
    GAME_UI.colors.forestDark
  )

  container.add([shadow, rim, face, glyph])

  let currentIcon = icon
  let enabled = true

  const paint = (pressed = false): void => {
    const push = pressed ? GAME_UI.motion.pressedPush : 0

    shadow.clear()
    shadow.fillStyle(GAME_UI.colors.cocoa, 0.26)
    shadow.fillCircle(0, GAME_UI.shadow.iconY, radius + 1)

    rim.clear()
    rim.fillStyle(GAME_UI.colors.honeyDark, 0.94)
    rim.fillCircle(0, push + 2, radius)

    face.clear()
    face.fillStyle(pressed ? 0xf4e7c5 : GAME_UI.colors.creamLight, 1)
    face.fillCircle(0, push - 2, radius - 3)
    face.lineStyle(1.6, 0xffffff, GAME_UI.alpha.softBorder)
    face.strokeCircle(0, push - 2, radius - 5)

    glyph
      .setTexture(gameUiIconTexture(currentIcon))
      .setPosition(0, push - 2)
      .setDisplaySize(GAME_UI.size.iconGlyph, GAME_UI.size.iconGlyph)
      .setTint(GAME_UI.colors.forestDark)
  }

  const repaint = (pressed = false): void => {
    paint(pressed)
  }

  repaint()

  container.setSize(radius * 2, radius * 2)
  // Phaser 4 Container hitArea uses local coordinates after displayOrigin.
  container.setInteractive(
    new Phaser.Geom.Circle(radius + 6, radius + 6, radius + 7),
    Phaser.Geom.Circle.Contains
  )

  container.on('pointerdown', () => {
    if (!enabled) return
    repaint(true)
    scene.tweens.add({
      targets: container,
      scale: 0.96,
      duration: GAME_UI.motion.pressMs,
      ease: 'Sine.Out'
    })
  })

  container.on('pointerup', () => {
    if (!enabled) return
    repaint(false)
    scene.tweens.add({
      targets: container,
      scale: 1,
      duration: GAME_UI.motion.releaseMs,
      ease: 'Back.Out'
    })
    action()
  })

  container.on('pointerout', () => {
    repaint(false)
    container.setScale(1)
  })

  return {
    container,
    setPosition(x: number, y: number) {
      container.setPosition(x, y)
    },
    setIcon(next: GameUiIconName) {
      currentIcon = next
      repaint(false)
    },
    setEnabled(next: boolean) {
      enabled = next
      container.setAlpha(next ? 1 : GAME_UI.alpha.disabled)
      if (container.input) container.input.enabled = next
    }
  }
}
