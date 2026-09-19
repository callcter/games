import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { GAME_UI, GAME_UI_FONT } from '../tokens'
import { createIconButton, type GameIconButton } from './icon-button'
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
  /** 内容从 135 开始的旧益智布局，短画布需要更紧凑的顶栏。 */
  compactContent?: boolean
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

  let signature = ''
  let back: GameIconButton
  let help: GameIconButton
  let sound: GameIconButton
  let tools: { container: Phaser.GameObjects.Container; width: number }[] = []
  const buttons = scene.add.container(0, 0)
  root.add(buttons)
  let availableTitleWidth = 304
  let viewportWidth = scene.scale.width
  let compact = false

  // 只在尺寸档位改变时重建按钮；棋盘和状态不重建。触控半径与绘制尺寸一同更新。
  const buildButtons = (narrow: boolean, tall: boolean): number => {
    const radius = narrow ? 22 : tall ? 44 : 34
    const nextSignature = `${narrow}:${tall}`
    if (signature === nextSignature) return radius
    signature = nextSignature
    for (const child of buttons.list) scene.tweens.killTweensOf(child)
    buttons.removeAll(true)
    const iconOptions = { radius, glyphSize: narrow ? 24 : tall ? 42 : 30 }
    back = createIconButton(scene, 'back', options.onBack, iconOptions)
    help = createIconButton(scene, 'hint', options.onHelp, iconOptions)
    sound = createIconButton(scene, options.audio.isMuted ? 'muted' : 'sound', () => {
      options.audio.toggleMuted()
      sound.setIcon(options.audio.isMuted ? 'muted' : 'sound')
    }, iconOptions)
    back.container.setName('chrome-back')
    help.container.setName('chrome-help')
    sound.container.setName('chrome-sound')
    buttons.add([back.container, help.container, sound.container])
    tools = (options.tools ?? []).map((tool, index) => {
      const width = narrow ? radius * 2 : 108
      const button = narrow
        ? createIconButton(scene, tool.icon, tool.action, iconOptions)
        : createToolButton(scene, tool.icon, tool.label, tool.action, { width, height: tall ? 60 : 50 })
      button.container.setName(`chrome-tool-${index}`)
      buttons.add(button.container)
      return { container: button.container, width }
    })
    return radius
  }

  const titleRoot = scene.add.container(0, 0).setName('chrome-title')
  const titleShadow = scene.add.graphics()
  const titleFace = scene.add.graphics()
  const titleText = scene.add.text(0, -2, options.title, {
    fontFamily: GAME_UI_FONT,
    fontSize: '25px',
    color: '#fffdf6',
    fontStyle: 'bold'
  }).setOrigin(0.5)
  titleRoot.add([titleShadow, titleFace, titleText])

  const statusRoot = scene.add.container(0, 0)
  const statusShadow = scene.add.graphics()
  const statusFace = scene.add.graphics()
  const statusText = scene.add.text(0, -1, '', {
    fontFamily: GAME_UI_FONT,
    fontSize: '17px',
    color: '#5a4939',
    fontStyle: 'bold',
    align: 'center'
  }).setOrigin(0.5)
  statusRoot.add([statusShadow, statusFace, statusText])

  root.add([titleRoot, statusRoot])

  const paintTitle = (): void => {
    const width = Math.min(availableTitleWidth, titleText.width + 40)
    const height = viewportWidth < 560 ? 46 : compact ? 50 : 62
    const radius = height / 2
    titleRoot.setSize(width, height)
    titleShadow.clear()
    titleShadow.fillStyle(GAME_UI.colors.forestDark, 0.30)
    titleShadow.fillRoundedRect(
      -width / 2,
      -height / 2 + 7,
      width,
      height,
      radius
    )

    titleFace.clear()
    titleFace.fillStyle(GAME_UI.colors.forest, 0.985)
    titleFace.fillRoundedRect(-width / 2, -height / 2, width, height, radius)
    titleFace.lineStyle(2.2, GAME_UI.colors.honey, 0.76)
    titleFace.strokeRoundedRect(
      -width / 2 + 1,
      -height / 2 + 1,
      width - 2,
      height - 2,
      radius - 1
    )
    titleFace.lineStyle(1.4, 0xffffff, 0.14)
    titleFace.strokeRoundedRect(
      -width / 2 + 4,
      -height / 2 + 4,
      width - 8,
      height - 8,
      radius - 4
    )
  }

  const paintStatus = (): void => {
    const value = statusText.text.trim()
    statusRoot.setVisible(Boolean(value))
    if (!value) return

    const width = Math.min(viewportWidth - 24, Math.max(170, statusText.width + 32))
    const height = Math.max(compact ? 32 : 44, statusText.height + (compact ? 8 : 12))
    const radius = height / 2

    statusShadow.clear()
    statusShadow.fillStyle(GAME_UI.colors.cocoa, 0.14)
    statusShadow.fillRoundedRect(-width / 2, -height / 2 + 4, width, height, radius)

    statusFace.clear()
    statusFace.fillStyle(GAME_UI.colors.creamLight, 0.91)
    statusFace.fillRoundedRect(-width / 2, -height / 2, width, height, radius)
    statusFace.lineStyle(1.5, GAME_UI.colors.honey, 0.48)
    statusFace.strokeRoundedRect(
      -width / 2 + 1,
      -height / 2 + 1,
      width - 2,
      height - 2,
      radius - 1
    )
  }

  return {
    container: root,
    setMuted(muted: boolean): void {
      sound?.setIcon(muted ? 'muted' : 'sound')
    },
    setStatus(value: string): void {
      if (statusText.text === value) return
      statusText.setText(value)
      paintStatus()
    },
    layout(width: number, height: number): void {
      viewportWidth = width
      const narrow = width < 560
      const tall = height >= 1180
      const radius = buildButtons(narrow, tall)
      compact = Boolean(options.compactContent) && height <= 960
      const topY = compact ? 44 : tall ? 90 : 70
      const edge = narrow ? 32 : 62
      const gap = narrow ? 10 : 20
      back.setPosition(edge, topY)
      sound.setPosition(width - edge, topY)
      help.setPosition(width - edge - radius * 2 - gap, topY)
      // cursor 是已占用区域的左边界，不能把按钮中心误当成边界。
      let cursor = help.container.x - radius - gap
      for (const tool of tools) {
        tool.container.setPosition(cursor - tool.width / 2, topY)
        cursor -= tool.width + gap
      }
      const left = edge + radius + gap
      availableTitleWidth = Math.min(304, cursor - left)
      titleText.setFontSize(narrow ? 18 : tall ? 32 : 25)
      titleText.setScale(Math.min(1, Math.max(0, availableTitleWidth - 24) / titleText.width))
      paintTitle()
      const halfTitle = titleRoot.width / 2
      titleRoot.setPosition(Phaser.Math.Clamp(width / 2, left + halfTitle, cursor - halfTitle), topY)
      statusText.setFontSize(narrow ? 14 : compact ? 15 : tall ? 22 : 17)
      statusText.setWordWrapWidth(Math.min(564, width - 56), true)
      statusRoot.setPosition(width / 2, topY + (compact ? 64 : 72))
      paintStatus()
    }
  }
}
