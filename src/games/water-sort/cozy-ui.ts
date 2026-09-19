/**
 * Compatibility bridge.
 *
 * WaterSortScene 继续使用原 API 名称，但底层视觉已经全部来自 src/ui。
 * 这避免本次“设计系统 Sprint”同时重写倒水/求解等稳定业务逻辑。
 */
import Phaser from 'phaser'
import {
  GAME_UI,
  createModeSelector,
  createStatChip as createSharedStatChip,
  createToolButton as createSharedToolButton,
  type GameModeSelector,
  type GameStatChip,
  type GameToolButton
} from '../../ui'

export const WATER_UI = {
  forest: GAME_UI.colors.forest,
  forestDark: GAME_UI.colors.forestDark,
  cream: GAME_UI.colors.cream,
  creamLight: GAME_UI.colors.creamLight,
  honey: GAME_UI.colors.honey,
  honeyDark: GAME_UI.colors.honeyDark,
  cocoa: GAME_UI.colors.cocoa,
  coral: GAME_UI.colors.coral,
  sky: GAME_UI.colors.sky,
  sage: GAME_UI.colors.sage
} as const

export type WaterIcon =
  | 'back'
  | 'sound'
  | 'muted'
  | 'undo'
  | 'hint'
  | 'new'
  | 'help'

export type ToolButton = GameToolButton
export type StatChip = GameStatChip

export interface ModePill extends GameModeSelector {
  setLabel(label: string): void
}

function modeIndex(label: string): number {
  if (label === '进阶') return 1
  if (label === '挑战') return 2
  return 0
}

export function createToolButton(
  scene: Phaser.Scene,
  icon: WaterIcon,
  label: string,
  action: () => void
): ToolButton {
  return createSharedToolButton(scene, icon, label, action)
}

export function createModePill(
  scene: Phaser.Scene,
  label: string,
  action: () => void
): ModePill {
  const selector = createModeSelector(scene, {
    index: modeIndex(label),
    total: 3,
    label,
    onPress: action
  })

  return {
    ...selector,
    setLabel(next: string) {
      selector.setMode(modeIndex(next), 3, next)
    }
  }
}

export function createStatChip(scene: Phaser.Scene, value: string): StatChip {
  return createSharedStatChip(scene, value)
}
