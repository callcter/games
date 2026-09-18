import Phaser from 'phaser'

// 红包雨的 AI 生成素材：2×2 精灵表（合红包/开包金币/炮仗/金币）与灯笼夜街背景。
export const RAIN_SHEET_KEY = 'red-rain-sheet'
export const RAIN_BG_KEY = 'red-rain-bg'

const SHEET_CELL = 320 // 640×640 表的格边

export function preloadRainArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(RAIN_SHEET_KEY)) scene.load.spritesheet(RAIN_SHEET_KEY, 'art/red-rain-sheet.png', { frameWidth: SHEET_CELL, frameHeight: SHEET_CELL })
  if (!scene.textures.exists(RAIN_BG_KEY)) scene.load.image(RAIN_BG_KEY, 'art/red-rain-bg.png')
}

export function rainSheetReady(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(RAIN_SHEET_KEY)) return false
  return Object.prototype.hasOwnProperty.call(scene.textures.get(RAIN_SHEET_KEY).frames, '3')
}
