import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createIconButton } from './icon-button'
import { createToolButton } from './tool-button'
import type { GameUiIconName } from '../icons'
import { GAME_UI, GAME_UI_FONT } from '../tokens'

export interface LegacyChromeTool {
  icon: GameUiIconName
  label: string
  action: () => void
}

export interface LegacyChromeOptions {
  width: number
  title: string
  audio: GameAudio
  onBack: () => void
  /** 顶栏中心 y */
  y: number
  tools?: readonly LegacyChromeTool[]
}

export interface LegacyChrome {
  container: Phaser.GameObjects.Container
  setMuted(muted: boolean): void
}

/**
 * 独立场景（2048/五子棋/扫雷/俄罗斯方块等）的统一顶栏：
 * 返回圆钮 + 标题 + 右侧工具与声音圆钮。
 * 宽屏用"图标+文字"药丸；窄屏（<560，手机竖屏）收紧为
 * 标题靠左 + 图标圆钮，避免按钮与标题互相挤压重叠。
 * 场景 preload 需自行调用 preloadGameUi(scene) 加载 Phosphor 图标。
 */
export function createLegacyChrome(scene: Phaser.Scene, options: LegacyChromeOptions): LegacyChrome {
  const container = scene.add.container(0, 0).setDepth(GAME_UI.depth.chrome)
  const compact = options.width < 560
  const radius = 21

  const back = createIconButton(scene, 'back', options.onBack, { radius })
  back.setPosition(radius + 20, options.y)
  container.add(back.container)

  const sound = createIconButton(scene, options.audio.isMuted ? 'muted' : 'sound', () => {
    options.audio.toggleMuted()
    sound.setIcon(options.audio.isMuted ? 'muted' : 'sound')
  }, { radius })

  const title = scene.add.text(0, options.y, options.title, {
    fontFamily: GAME_UI_FONT,
    fontSize: compact ? '24px' : '30px',
    color: '#244c43',
    fontStyle: 'bold'
  }).setOrigin(compact ? 0 : 0.5, 0.5)
  if (compact) title.setPosition(radius * 2 + 38, options.y)
  else title.setPosition(options.width / 2, options.y)
  container.add(title)

  let right = options.width - radius - 20
  sound.setPosition(right, options.y)
  container.add(sound.container)

  for (const tool of [...(options.tools ?? [])].reverse()) {
    if (compact) {
      // 窄屏：只保留图标圆钮（问号/循环箭头本身语义完整），不与标题争空间
      right -= radius + 8 + radius
      const button = createIconButton(scene, tool.icon, tool.action, { radius })
      button.setPosition(right, options.y)
      container.add(button.container)
    } else {
      const width = 96
      right -= radius + 10 + width / 2
      const button = createToolButton(scene, tool.icon, tool.label, tool.action, { width, height: 46 })
      button.setPosition(right, options.y)
      container.add(button.container)
      right -= width / 2
    }
  }

  return {
    container,
    setMuted(muted: boolean): void {
      sound.setIcon(muted ? 'muted' : 'sound')
    }
  }
}
