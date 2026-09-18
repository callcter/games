import Phaser from 'phaser'

export const MATCH_SHEET_KEY = 'tile-match-sheet-v2'
export const MATCH_BG_KEY = 'tile-match-bg'

export const MATCH_SFX = {
  ui: 'tile-match-ui',
  pick: 'tile-match-pick',
  land: 'tile-match-land',
  match: 'tile-match-match',
  shuffle: 'tile-match-shuffle',
  victory: 'tile-match-victory'
} as const

const SHEET_CELL = 256

// core kind 顺序：苹果/香蕉/葡萄/西瓜/橙子/草莓/樱桃/猕猴桃/菠萝/芒果
export const TILE_KIND_FRAME: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

export function preloadMatchArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(MATCH_SHEET_KEY)) {
    scene.load.spritesheet(MATCH_SHEET_KEY, 'art/tile-match-sheet-v2.png', {
      frameWidth: SHEET_CELL,
      frameHeight: SHEET_CELL
    })
  }
  if (!scene.textures.exists(MATCH_BG_KEY)) {
    scene.load.image(MATCH_BG_KEY, 'art/tile-match-bg.png')
  }

  scene.load.audio(MATCH_SFX.ui, 'audio/tile-match/ui-tap.wav')
  scene.load.audio(MATCH_SFX.pick, 'audio/tile-match/pick.wav')
  scene.load.audio(MATCH_SFX.land, 'audio/tile-match/land.wav')
  scene.load.audio(MATCH_SFX.match, 'audio/tile-match/match.wav')
  scene.load.audio(MATCH_SFX.shuffle, 'audio/tile-match/shuffle.wav')
  scene.load.audio(MATCH_SFX.victory, 'audio/tile-match/victory.wav')
}

export function matchSheetReady(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(MATCH_SHEET_KEY)) return false
  return Object.prototype.hasOwnProperty.call(scene.textures.get(MATCH_SHEET_KEY).frames, '9')
}
