import Phaser from 'phaser'

// 打地鼠的 AI 生成素材（docs/art-prompts.md「游戏内素材」）：2×2 四态精灵表
// （0 开心 / 1 晕头 / 2 睡帽宝宝 / 3 宝宝惊醒）+ 立体土丘洞 + 草地背景。
// 素材缺失时场景退回原有程序化绘制，游戏不受影响。
export const MOLE_SHEET_KEY = 'whack-moles'
export const WHACK_HOLE_KEY = 'whack-hole'
export const WHACK_BG_KEY = 'whack-bg'

const SHEET_CELL = 320 // 640×640 表的半宽，与 art/whack-moles.png 降采样规格一致

export function preloadWhackArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(MOLE_SHEET_KEY)) scene.load.spritesheet(MOLE_SHEET_KEY, 'art/whack-moles.png', { frameWidth: SHEET_CELL, frameHeight: SHEET_CELL })
  if (!scene.textures.exists(WHACK_HOLE_KEY)) scene.load.image(WHACK_HOLE_KEY, 'art/whack-hole.png')
  if (!scene.textures.exists(WHACK_BG_KEY)) scene.load.image(WHACK_BG_KEY, 'art/whack-bg.png')
}

/** 四态帧是否齐全（加载失败时为 false，调用方走程序化兜底）。 */
export function whackMolesReady(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(MOLE_SHEET_KEY)) return false
  const frames = scene.textures.get(MOLE_SHEET_KEY).frames
  return Object.prototype.hasOwnProperty.call(frames, '3')
}
