import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { GAME_UI, GAME_UI_FONT } from '../tokens'
import { createIconButton } from './icon-button'

export interface PuzzleChrome {
  container: Phaser.GameObjects.Container
  setMuted(muted: boolean): void
  setStatus(value: string): void
  layout(width: number, height: number): void
}

export interface PuzzleChromeOptions {
  title: string
  audio: GameAudio
  onBack: () => void
  onHelp: () => void
}

/**
 * Puzzle / Action 公共应用层顶栏。
 *
 * 和 Tile Match / Water Sort 使用同一组 token 与 Phosphor 图标：
 * [返回]      [标题胶囊]      [帮助][声音]
 *                 [状态胶囊]
 *
 * 游戏自己的棋盘、牌面、工具按钮仍属于内容层，不塞进这里。
 */
export function createPuzzleChrome(
  scene: Phaser.Scene,
  options: PuzzleChromeOptions
): PuzzleChrome {
  const root = scene.add.container(0, 0).setDepth(GAME_UI.depth.chrome)

  const tallPhone = scene.scale.height >= 1180
  const iconRadius = tallPhone ? 44 : 34
  const glyphSize = tallPhone ? 42 : 30
  const back = createIconButton(scene, 'back', options.onBack, {
    radius: iconRadius,
    glyphSize,
    depth: GAME_UI.depth.chrome
  })
  const help = createIconButton(scene, 'hint', options.onHelp, {
    radius: iconRadius,
    glyphSize: tallPhone ? 38 : 28,
    depth: GAME_UI.depth.chrome
  })
  const sound = createIconButton(
    scene,
    options.audio.isMuted ? 'muted' : 'sound',
    () => {
      options.audio.toggleMuted()
      sound.setIcon(options.audio.isMuted ? 'muted' : 'sound')
    },
    {
      radius: iconRadius,
      glyphSize,
      depth: GAME_UI.depth.chrome
    }
  )

  const titleRoot = scene.add.container(0, 0)
  const titleShadow = scene.add.graphics()
  const titleFace = scene.add.graphics()
  const titleText = scene.add.text(0, -2, options.title, {
    fontFamily: GAME_UI_FONT,
    fontSize: tallPhone ? '32px' : '25px',
    color: '#fffdf6',
    fontStyle: 'bold'
  }).setOrigin(0.5)
  titleRoot.add([titleShadow, titleFace, titleText])

  const statusRoot = scene.add.container(0, 0)
  const statusShadow = scene.add.graphics()
  const statusFace = scene.add.graphics()
  const statusText = scene.add.text(0, -1, '', {
    fontFamily: GAME_UI_FONT,
    fontSize: tallPhone ? '22px' : '17px',
    color: '#5a4939',
    fontStyle: 'bold',
    align: 'center'
  }).setOrigin(0.5)
  statusRoot.add([statusShadow, statusFace, statusText])

  root.add([
    back.container,
    titleRoot,
    help.container,
    sound.container,
    statusRoot
  ])

  const paintTitle = (): void => {
    const width = Phaser.Math.Clamp(titleText.width + 74, 190, 304)
    const height = 62
    titleShadow.clear()
    titleShadow.fillStyle(GAME_UI.colors.forestDark, 0.30)
    titleShadow.fillRoundedRect(
      -width / 2,
      -height / 2 + 7,
      width,
      height,
      31
    )

    titleFace.clear()
    titleFace.fillStyle(GAME_UI.colors.forest, 0.985)
    titleFace.fillRoundedRect(-width / 2, -height / 2, width, height, 31)
    titleFace.lineStyle(2.2, GAME_UI.colors.honey, 0.76)
    titleFace.strokeRoundedRect(
      -width / 2 + 1,
      -height / 2 + 1,
      width - 2,
      height - 2,
      30
    )
    titleFace.lineStyle(1.4, 0xffffff, 0.14)
    titleFace.strokeRoundedRect(
      -width / 2 + 4,
      -height / 2 + 4,
      width - 8,
      height - 8,
      27
    )
  }

  const paintStatus = (): void => {
    const value = statusText.text.trim()
    statusRoot.setVisible(Boolean(value))
    if (!value) return

    const width = Phaser.Math.Clamp(statusText.width + 54, 170, 596)
    const height = 44

    statusShadow.clear()
    statusShadow.fillStyle(GAME_UI.colors.cocoa, 0.14)
    statusShadow.fillRoundedRect(-width / 2, -height / 2 + 4, width, height, 22)

    statusFace.clear()
    statusFace.fillStyle(GAME_UI.colors.creamLight, 0.91)
    statusFace.fillRoundedRect(-width / 2, -height / 2, width, height, 22)
    statusFace.lineStyle(1.5, GAME_UI.colors.honey, 0.48)
    statusFace.strokeRoundedRect(
      -width / 2 + 1,
      -height / 2 + 1,
      width - 2,
      height - 2,
      21
    )
  }

  paintTitle()
  paintStatus()

  return {
    container: root,
    setMuted(muted: boolean): void {
      sound.setIcon(muted ? 'muted' : 'sound')
    },
    setStatus(value: string): void {
      statusText.setText(value)
      paintStatus()
    },
    layout(width: number, height: number): void {
      const topY = height >= 1180 ? 90 : 70
      const edge = 62
      const gap = 88

      back.setPosition(edge, topY)
      sound.setPosition(width - edge, topY)
      help.setPosition(width - edge - gap, topY)
      titleRoot.setPosition(width / 2, topY)
      statusRoot.setPosition(width / 2, topY + 72)
    }
  }
}
