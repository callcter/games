import Phaser from 'phaser'

// 点泡泡的 AI 生成素材：3×2 泡泡精灵表（蓝/粉/黄/绿 + 金色 + 空）与晴空背景。
export const POP_SHEET_KEY = 'pop-bubbles-sheet'
export const POP_BG_KEY = 'pop-bubbles-bg'

const SHEET_CELL = 256 // 768×512 表的格边

export function preloadPopArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(POP_SHEET_KEY)) scene.load.spritesheet(POP_SHEET_KEY, 'art/pop-bubbles-sheet.png', { frameWidth: SHEET_CELL, frameHeight: SHEET_CELL })
  if (!scene.textures.exists(POP_BG_KEY)) scene.load.image(POP_BG_KEY, 'art/pop-bubbles-bg.png')
}

export function popSheetReady(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(POP_SHEET_KEY)) return false
  return Object.prototype.hasOwnProperty.call(scene.textures.get(POP_SHEET_KEY).frames, '4')
}
