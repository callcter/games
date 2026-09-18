import Phaser from 'phaser'
import { GAME_UI, GAME_UI_FONT } from '../tokens'

export interface GameStatChip {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setText(value: string): void
}

export function createStatChip(scene: Phaser.Scene, value: string): GameStatChip {
  const width = GAME_UI.size.chipWidth
  const height = GAME_UI.size.chipHeight

  const container = scene.add.container(0, 0).setDepth(GAME_UI.depth.chrome - 50)
  const shadow = scene.add.graphics()
  shadow.fillStyle(GAME_UI.colors.cocoa, 0.17)
  shadow.fillRoundedRect(
    -width / 2,
    -height / 2 + 4,
    width,
    height,
    GAME_UI.radius.chip
  )

  const face = scene.add.graphics()
  face.fillStyle(GAME_UI.colors.creamLight, 0.92)
  face.fillRoundedRect(-width / 2, -height / 2, width, height, GAME_UI.radius.chip)
  face.lineStyle(1.5, GAME_UI.colors.honey, 0.56)
  face.strokeRoundedRect(
    -width / 2 + 1,
    -height / 2 + 1,
    width - 2,
    height - 2,
    GAME_UI.radius.chip - 1
  )

  const text = scene.add.text(0, -1, value, {
    fontFamily: GAME_UI_FONT,
    fontSize: `${GAME_UI.font.chipSize}px`,
    color: '#5a4939',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  container.add([shadow, face, text])

  return {
    container,
    setPosition(x: number, y: number) {
      container.setPosition(x, y)
    },
    setText(next: string) {
      text.setText(next)
    }
  }
}
