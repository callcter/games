import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { GAME_UI, GAME_UI_FONT } from '../tokens'
import { createIconButton } from './icon-button'
import { createToolButton } from './tool-button'
import type { GameUiIconName } from '../icons'

export interface PuzzleChromeTool {
  icon: GameUiIconName
  label: string
  action: () => void
}

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
  /** 额外顶栏工具（如重开），排在帮助钮左侧；宽屏为图标药丸、窄屏退化为纯图标圆钮。 */
  tools?: readonly PuzzleChromeTool[]
}

/**
 * 全站统一的应用级顶栏（Puzzle/Action/独立场景共用）。
 *
 * [返回]      [标题胶囊]      [工具…][帮助][声音]
 *                 [状态胶囊]
 *
 * 游戏自己的棋盘、牌面、工具按钮仍属于内容层，不塞进这里。
 * 场景需已通过 PuzzleUiBootScene/preloadGameUi 加载 Phosphor 图标。
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

  // 宽屏用“图标+文字”药丸；窄屏（<560）只留图标圆钮，不与标题胶囊争空间。
  const narrow = scene.scale.width < 560
  const tools = (options.tools ?? []).map(tool => {
    if (narrow) {
      const button = createIconButton(scene, tool.icon, tool.action, {
        radius: iconRadius,
        glyphSize,
        depth: GAME_UI.depth.chrome
      })
      root.add(button.container)
      return { place(x: number, y: number): void { button.setPosition(x, y) }, span: iconRadius * 2 + 20 }
    }
    const button = createToolButton(scene, tool.icon, tool.label, tool.action, {
      width: 108,
      height: tallPhone ? 60 : 50
    })
    root.add(button.container)
    return { place(x: number, y: number): void { button.setPosition(x, y) }, span: 124 }
  })

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
      // 工具从帮助钮继续向左排；返回钮在窄屏贴左，中间标题胶囊保持居中。
      let cursor = width - edge - gap
      for (const tool of tools) {
        cursor -= tool.span / 2 + 10
        tool.place(cursor, topY)
        cursor -= tool.span / 2
      }
      titleRoot.setPosition(width / 2, topY)
      statusRoot.setPosition(width / 2, topY + 72)
    }
  }
}
