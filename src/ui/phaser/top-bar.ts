import Phaser from 'phaser'
import type { GameUiIconName } from '../icons'
import { GAME_UI } from '../tokens'
import { createIconButton, type GameIconButton } from './icon-button'
import { createModeSelector, type GameModeSelector } from './mode-selector'

export interface GameTopBar {
  left: GameIconButton
  mode: GameModeSelector
  right: GameIconButton
  layout(topY: number, width?: number): void
}

export interface GameTopBarOptions {
  leftIcon?: GameUiIconName
  onLeft: () => void
  rightIcon?: GameUiIconName
  onRight: () => void
  modeIndex: number
  modeTotal: number
  modeLabel: string
  onMode: () => void
}

/**
 * 新游戏优先直接使用 TopBar，而不是再分别摆三个 control。
 * Tile Match / Water Sort v1 先通过 compatibility bridge 迁移视觉，
 * 后续 Parking 起直接使用本组件。
 */
export function createGameTopBar(
  scene: Phaser.Scene,
  options: GameTopBarOptions
): GameTopBar {
  const left = createIconButton(scene, options.leftIcon ?? 'back', options.onLeft)
  const right = createIconButton(scene, options.rightIcon ?? 'sound', options.onRight)
  const mode = createModeSelector(scene, {
    index: options.modeIndex,
    total: options.modeTotal,
    label: options.modeLabel,
    onPress: options.onMode
  })

  return {
    left,
    mode,
    right,
    layout(topY: number, width = GAME_UI.layout.designWidth) {
      left.setPosition(GAME_UI.layout.edgeX, topY)
      mode.setPosition(width / 2, topY)
      right.setPosition(width - GAME_UI.layout.edgeX, topY)
    }
  }
}
