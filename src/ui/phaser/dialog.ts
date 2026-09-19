import Phaser from 'phaser'
import { GAME_UI, GAME_UI_FONT } from '../tokens'

export interface DialogAction {
  label: string
  primary?: boolean
  onPress: () => void
}

export interface GameDialog {
  root: Phaser.GameObjects.Container
  card: Phaser.GameObjects.Container
  close(): void
}

export interface DialogOptions {
  width?: number
  title: string
  body?: string
  actions: readonly DialogAction[]
}

function createDialogButton(
  scene: Phaser.Scene,
  label: string,
  primary: boolean,
  action: () => void
): Phaser.GameObjects.Container {
  const width = 308
  const height = 58
  const button = scene.add.container(0, 0)

  const shadow = scene.add.graphics()
  const face = scene.add.graphics()
  const text = scene.add.text(0, -1, label, {
    fontFamily: GAME_UI_FONT,
    fontSize: '20px',
    color: primary ? '#fffdf6' : '#285c50',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  const paint = (pressed = false): void => {
    const push = pressed ? GAME_UI.motion.pressedPush : 0

    shadow.clear()
    shadow.fillStyle(GAME_UI.colors.cocoa, 0.22)
    shadow.fillRoundedRect(-width / 2, -height / 2 + 7, width, height, 22)

    face.clear()
    face.fillStyle(
      primary
        ? pressed ? GAME_UI.colors.forestDark : GAME_UI.colors.forest
        : pressed ? 0xeadfbe : GAME_UI.colors.cream,
      1
    )
    face.fillRoundedRect(-width / 2, -height / 2 + push, width, height, 22)
    face.lineStyle(2, primary ? 0xffffff : GAME_UI.colors.honey, primary ? 0.12 : 0.70)
    face.strokeRoundedRect(
      -width / 2 + 2,
      -height / 2 + push + 2,
      width - 4,
      height - 4,
      20
    )
    text.y = push - 1
  }

  paint()
  button.add([shadow, face, text])
  button.setSize(width, height)
  button.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains
  )

  button.on('pointerdown', () => {
    paint(true)
    button.setScale(0.98)
  })
  button.on('pointerup', () => {
    paint(false)
    button.setScale(1)
    action()
  })
  button.on('pointerout', () => {
    paint(false)
    button.setScale(1)
  })

  return button
}

export function showGameDialog(scene: Phaser.Scene, options: DialogOptions): GameDialog {
  const sceneHeight = scene.scale.height
  const width = options.width ?? 540
  const root = scene.add.container(0, 0).setDepth(GAME_UI.depth.dialog)

  const shade = scene.add
    .rectangle(
      GAME_UI.layout.designWidth / 2,
      sceneHeight / 2,
      GAME_UI.layout.designWidth,
      sceneHeight,
      GAME_UI.colors.forestDark,
      0.37
    )
    .setInteractive()

  const card = scene.add.container(GAME_UI.layout.designWidth / 2, sceneHeight / 2)
  const shadow = scene.add.graphics()
  shadow.fillStyle(GAME_UI.colors.cocoa, 0.27)
  shadow.fillRoundedRect(
    -width / 2,
    -188 + GAME_UI.shadow.dialogY,
    width,
    376,
    GAME_UI.radius.dialog
  )

  const panel = scene.add.graphics()
  panel.fillStyle(GAME_UI.colors.creamLight, GAME_UI.alpha.panel)
  panel.fillRoundedRect(-width / 2, -188, width, 376, GAME_UI.radius.dialog)
  panel.lineStyle(4, GAME_UI.colors.honey, 0.82)
  panel.strokeRoundedRect(
    -width / 2 + 2,
    -186,
    width - 4,
    372,
    GAME_UI.radius.dialog - 2
  )

  const title = scene.add.text(0, -104, options.title, {
    fontFamily: GAME_UI_FONT,
    fontSize: `${GAME_UI.font.dialogTitleSize}px`,
    color: '#285c50',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  const body = scene.add.text(0, -56, options.body ?? '', {
    fontFamily: GAME_UI_FONT,
    fontSize: `${GAME_UI.font.dialogBodySize}px`,
    color: '#6b5947',
    fontStyle: 'bold',
    align: 'center',
    wordWrap: { width: width - 90 }
  }).setOrigin(0.5)

  card.add([shadow, panel, title, body])

  const gap = 70
  const startY = options.actions.length === 1 ? 44 : 22
  options.actions.forEach((action, index) => {
    const button = createDialogButton(
      scene,
      action.label,
      action.primary ?? index === 0,
      action.onPress
    )
    button.setPosition(0, startY + index * gap)
    card.add(button)
  })

  const layout = (): void => {
    const { width: sceneWidth, height: sceneHeight } = scene.scale
    shade.setPosition(sceneWidth / 2, sceneHeight / 2).setSize(sceneWidth, sceneHeight)
    card.setPosition(sceneWidth / 2, sceneHeight / 2)
  }
  scene.scale.on(Phaser.Scale.Events.RESIZE, layout)
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, layout)
    scene.tweens.killTweensOf([root, card])
  })
  layout()

  root.add([shade, card])
  root.setAlpha(0)
  card.setScale(0.92)

  scene.tweens.add({ targets: root, alpha: 1, duration: 170 })
  scene.tweens.add({
    targets: card,
    scale: 1,
    duration: GAME_UI.motion.dialogMs,
    ease: 'Back.Out'
  })

  return {
    root,
    card,
    close() {
      root.destroy(true)
    }
  }
}
