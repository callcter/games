/**
 * Compatibility bridge.
 *
 * 真正实现已经迁到 src/ui；保留本文件只为了让 TileMatchScene
 * 在本 Sprint 不做大面积行为重写。后续可直接把 Scene import 改到 ../../ui。
 */
import Phaser from 'phaser'
import {
  GAME_UI,
  createIconButton,
  createModeSelector,
  createToolButton,
  type GameIconButton,
  type GameModeSelector,
  type GameToolButton,
  type GameUiIconName
} from '../../ui'

export const COZY = {
  forest: GAME_UI.colors.forest,
  forestDark: GAME_UI.colors.forestDark,
  cream: GAME_UI.colors.cream,
  creamLight: GAME_UI.colors.creamLight,
  honey: GAME_UI.colors.honey,
  honeyDark: GAME_UI.colors.honeyDark,
  coral: GAME_UI.colors.coral,
  cocoa: GAME_UI.colors.cocoa,
  sage: GAME_UI.colors.sage,
  ink: GAME_UI.colors.ink
} as const

export type CozyIconName =
  | 'back'
  | 'sound'
  | 'muted'
  | 'undo'
  | 'shuffle'
  | 'restart'

export type CozyIconButton = GameIconButton
export type CozyToolButton = GameToolButton
export type CozyPillButton = GameModeSelector

export function createCozyIconButton(
  scene: Phaser.Scene,
  icon: CozyIconName,
  action: () => void,
  _legacyRadius?: number
): CozyIconButton {
  // Ignore old per-game radius: this is intentionally standardized.
  return createIconButton(scene, icon as GameUiIconName, action)
}

export function createCozyToolButton(
  scene: Phaser.Scene,
  icon: Extract<CozyIconName, 'undo' | 'shuffle' | 'restart'>,
  label: string,
  action: () => void
): CozyToolButton {
  return createToolButton(scene, icon, label, action)
}

export function createCozyPillButton(
  scene: Phaser.Scene,
  initialIndex: number,
  total: number,
  label: string,
  action: () => void
): CozyPillButton {
  return createModeSelector(scene, {
    index: initialIndex,
    total,
    label,
    onPress: action
  })
}
