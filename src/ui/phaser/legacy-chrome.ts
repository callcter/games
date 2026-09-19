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
 * 返回圆钮 + 居中标题 + 右侧工具胶囊与声音圆钮。
 * 场景 preload 需自行调用 preloadGameUi(scene) 加载 Phosphor 图标。
 */
export function createLegacyChrome(scene: Phaser.Scene, options: LegacyChromeOptions): LegacyChrome {
  const container = scene.add.container(0, 0).setDepth(GAME_UI.depth.chrome)
  const radius = 21

  const back = createIconButton(scene, 'back', options.onBack, { radius })
  back.setPosition(radius + 20, options.y)
  container.add(back.container)

  const title = scene.add.text(options.width / 2, options.y, options.title, {
    fontFamily: GAME_UI_FONT,
    fontSize: '30px',
    color: '#244c43',
    fontStyle: 'bold'
  }).setOrigin(0.5)
  container.add(title)

  const sound = createIconButton(scene, options.audio.isMuted ? 'muted' : 'sound', () => {
    options.audio.toggleMuted()
    sound.setIcon(options.audio.isMuted ? 'muted' : 'sound')
  }, { radius })
  let right = options.width - radius - 20
  sound.setPosition(right, options.y)
  container.add(sound.container)

  for (const tool of [...(options.tools ?? [])].reverse()) {
    const width = 96
    right -= radius + 10 + width / 2
    const button = createToolButton(scene, tool.icon, tool.label, tool.action, { width, height: 46 })
    button.setPosition(right, options.y)
    container.add(button.container)
    right -= width / 2
  }

  return {
    container,
    setMuted(muted: boolean): void {
      sound.setIcon(muted ? 'muted' : 'sound')
    }
  }
}
