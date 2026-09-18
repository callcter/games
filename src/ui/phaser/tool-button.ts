import Phaser from 'phaser'
import { createGameUiIcon, type GameUiIconName } from '../icons'
import { GAME_UI, GAME_UI_FONT } from '../tokens'

export interface GameToolButton {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setBadge(value?: number): void
  setEnabled(enabled: boolean): void
}

export interface ToolButtonOptions {
  width?: number
  height?: number
  depth?: number
}

export function createToolButton(
  scene: Phaser.Scene,
  icon: GameUiIconName,
  label: string,
  action: () => void,
  options: ToolButtonOptions = {}
): GameToolButton {
  const width = options.width ?? GAME_UI.size.toolWidth
  const height = options.height ?? GAME_UI.size.toolHeight

  const container = scene.add.container(0, 0)
    .setDepth(options.depth ?? GAME_UI.depth.chrome)

  const shadow = scene.add.graphics()
  const rim = scene.add.graphics()
  const face = scene.add.graphics()
  const glyph = createGameUiIcon(scene, icon, 28, GAME_UI.colors.forestDark)
  const text = scene.add.text(18, -1, label, {
    fontFamily: GAME_UI_FONT,
    fontSize: `${GAME_UI.font.toolSize}px`,
    color: '#244c43',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  const badge = scene.add.container(width / 2 - 8, -height / 2 + 5).setVisible(false)
  const badgeShadow = scene.add.graphics()
  const badgeBg = scene.add.graphics()
  const badgeText = scene.add.text(0, 0, '', {
    fontFamily: GAME_UI_FONT,
    fontSize: '14px',
    color: '#fffdf6',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  badge.add([badgeShadow, badgeBg, badgeText])
  container.add([shadow, rim, face, glyph, text, badge])

  let enabled = true

  const paint = (pressed = false): void => {
    const push = pressed ? GAME_UI.motion.pressedPush : 0

    shadow.clear()
    shadow.fillStyle(GAME_UI.colors.cocoa, 0.23)
    shadow.fillRoundedRect(
      -width / 2,
      -height / 2 + GAME_UI.shadow.buttonY,
      width,
      height,
      GAME_UI.radius.tool
    )

    rim.clear()
    rim.fillStyle(GAME_UI.colors.honeyDark, 0.93)
    rim.fillRoundedRect(
      -width / 2,
      -height / 2 + push + 3,
      width,
      height - 1,
      GAME_UI.radius.tool
    )

    face.clear()
    face.fillStyle(pressed ? 0xf2e5c2 : GAME_UI.colors.creamLight, 1)
    face.fillRoundedRect(
      -width / 2 + 3,
      -height / 2 + push,
      width - 6,
      height - 7,
      GAME_UI.radius.tool - 3
    )
    face.lineStyle(1.6, 0xffffff, GAME_UI.alpha.softBorder)
    face.strokeRoundedRect(
      -width / 2 + 5,
      -height / 2 + push + 2,
      width - 10,
      height - 11,
      GAME_UI.radius.tool - 5
    )

    glyph.setPosition(-38, push - 1)
    text.y = push - 1
  }

  paint()

  container.setSize(width, height)
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains
  )

  container.on('pointerdown', () => {
    if (!enabled) return
    paint(true)
    scene.tweens.add({
      targets: container,
      scale: 0.98,
      duration: GAME_UI.motion.pressMs,
      ease: 'Sine.Out'
    })
  })

  container.on('pointerup', () => {
    if (!enabled) return
    paint(false)
    scene.tweens.add({
      targets: container,
      scale: 1,
      duration: GAME_UI.motion.releaseMs,
      ease: 'Back.Out'
    })
    action()
  })

  container.on('pointerout', () => {
    paint(false)
    container.setScale(1)
  })

  return {
    container,
    setPosition(x: number, y: number) {
      container.setPosition(x, y)
    },
    setBadge(value?: number) {
      if (value === undefined) {
        badge.setVisible(false)
        return
      }

      badgeShadow.clear()
      badgeShadow.fillStyle(GAME_UI.colors.cocoa, 0.30)
      badgeShadow.fillCircle(0, 3, 17)

      badgeBg.clear()
      badgeBg.fillStyle(value > 0 ? GAME_UI.colors.forest : GAME_UI.colors.disabled, 1)
      badgeBg.fillCircle(0, 0, 16)
      badgeBg.lineStyle(2.2, GAME_UI.colors.creamLight, 1)
      badgeBg.strokeCircle(0, 0, 15)

      badgeText.setText(String(value))
      badge.setVisible(true)
    },
    setEnabled(next: boolean) {
      enabled = next
      container.setAlpha(next ? 1 : GAME_UI.alpha.disabled)
      if (container.input) container.input.enabled = next
    }
  }
}
