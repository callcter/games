import Phaser from 'phaser'
import { createGameUiIcon } from '../icons'
import { GAME_UI, GAME_UI_FONT } from '../tokens'

export interface GameModeSelector {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setMode(index: number, total: number, label: string): void
  setLabel(label: string): void
  setEnabled(enabled: boolean): void
}

export interface ModeSelectorOptions {
  index: number
  total: number
  label: string
  onPress: () => void
  depth?: number
}

/**
 * 全局唯一难度/模式切换器。
 *
 * 叠叠消和水排序都必须使用同一尺寸、同一 dots、同一 chevron 和按压深度。
 */
export function createModeSelector(
  scene: Phaser.Scene,
  options: ModeSelectorOptions
): GameModeSelector {
  const width = GAME_UI.size.modeWidth
  const height = GAME_UI.size.modeHeight

  const container = scene.add.container(0, 0)
    .setDepth(options.depth ?? GAME_UI.depth.chrome)

  const shadow = scene.add.graphics()
  const face = scene.add.graphics()
  const chevron = createGameUiIcon(scene, 'next', 20, GAME_UI.colors.cream)
  const dots = scene.add.graphics()
  const text = scene.add.text(0, -7, options.label, {
    fontFamily: GAME_UI_FONT,
    fontSize: `${GAME_UI.font.modeSize}px`,
    color: '#fffdf6',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  container.add([shadow, face, chevron, dots, text])

  let currentIndex = options.index
  let currentTotal = options.total
  let enabled = true

  const paint = (pressed = false): void => {
    const push = pressed ? GAME_UI.motion.pressedPush : 0

    shadow.clear()
    shadow.fillStyle(GAME_UI.colors.forestDark, 0.30)
    shadow.fillRoundedRect(
      -width / 2,
      -height / 2 + GAME_UI.shadow.buttonY,
      width,
      height,
      GAME_UI.radius.mode
    )

    face.clear()
    face.fillStyle(pressed ? GAME_UI.colors.forestDark : GAME_UI.colors.forest, 0.985)
    face.fillRoundedRect(
      -width / 2,
      -height / 2 + push,
      width,
      height,
      GAME_UI.radius.mode
    )
    face.lineStyle(2.2, GAME_UI.colors.honey, 0.75)
    face.strokeRoundedRect(
      -width / 2 + 1,
      -height / 2 + push + 1,
      width - 2,
      height - 2,
      GAME_UI.radius.mode - 1
    )
    face.lineStyle(1.4, 0xffffff, 0.14)
    face.strokeRoundedRect(
      -width / 2 + 4,
      -height / 2 + push + 4,
      width - 8,
      height - 8,
      GAME_UI.radius.mode - 4
    )

    chevron
      .setPosition(62, -6 + push)
      .setDisplaySize(20, 20)
      .setTint(GAME_UI.colors.cream)
      .setAlpha(0.90)

    dots.clear()
    const gap = 12
    const startX = -gap * (currentTotal - 1) / 2
    for (let index = 0; index < currentTotal; index++) {
      dots.fillStyle(
        index === currentIndex ? GAME_UI.colors.honey : 0xffffff,
        index === currentIndex ? 1 : 0.34
      )
      dots.fillCircle(
        startX + index * gap,
        16 + push,
        index === currentIndex ? 3.7 : 3.1
      )
    }

    text.y = -7 + push
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
    container.setScale(0.98)
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
    options.onPress()
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
    setMode(index: number, total: number, label: string) {
      currentIndex = Math.max(0, Math.min(total - 1, index))
      currentTotal = Math.max(1, total)
      text.setText(label)
      paint(false)
    },
    setLabel(label: string) {
      text.setText(label)
      paint(false)
    },
    setEnabled(next: boolean) {
      enabled = next
      container.setAlpha(next ? 1 : GAME_UI.alpha.disabled)
      if (container.input) container.input.enabled = next
    }
  }
}
