import Phaser from 'phaser'

// 叠叠消的 AI 生成素材：3×3 牌面精灵表（草莓/香蕉/西瓜/绿苹果/葡萄/橙子/玛芬/蜂蜜，
// 第 9 格空）与客厅桌面背景。kind→帧映射见 TILE_KIND_FRAME；素材未覆盖的
// 樱桃/猕猴桃/菠萝/芒果保留原 emoji 牌面，规则可读性优先。
export const MATCH_SHEET_KEY = 'tile-match-sheet'
export const MATCH_BG_KEY = 'tile-match-bg'

const SHEET_CELL = 250 // 750×750 表的格边

// core kind 顺序：苹果/香蕉/葡萄/西瓜/橙子/草莓/樱桃/猕猴桃/菠萝/芒果
export const TILE_KIND_FRAME: readonly number[] = [3, 1, 4, 2, 5, 0, -1, -1, -1, -1]

export function preloadMatchArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(MATCH_SHEET_KEY)) scene.load.spritesheet(MATCH_SHEET_KEY, 'art/tile-match-sheet.png', { frameWidth: SHEET_CELL, frameHeight: SHEET_CELL })
  if (!scene.textures.exists(MATCH_BG_KEY)) scene.load.image(MATCH_BG_KEY, 'art/tile-match-bg.png')
}

export function matchSheetReady(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(MATCH_SHEET_KEY)) return false
  return Object.prototype.hasOwnProperty.call(scene.textures.get(MATCH_SHEET_KEY).frames, '7')
}
