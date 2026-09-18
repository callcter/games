import Phaser from 'phaser'

// 水排序的 AI 生成素材（docs/art-prompts.md「游戏内素材」）：不透明玻璃管身作
// 水层底图、透明高光覆盖叠在水层之上（渲染次序：背景→管身→程序色水层→高光→
// 选中描边）、木桌台面背景。素材缺失时场景退回原程序化绘制。
export const WATER_TUBE_KEY = 'water-tube'
export const WATER_GLOSS_KEY = 'water-tube-gloss'
export const WATER_BG_KEY = 'water-bg'

export function preloadWaterArt(scene: Phaser.Scene): void {
  if (!scene.textures.exists(WATER_TUBE_KEY)) scene.load.image(WATER_TUBE_KEY, 'art/water-tube.png')
  if (!scene.textures.exists(WATER_GLOSS_KEY)) scene.load.image(WATER_GLOSS_KEY, 'art/water-tube-gloss.png')
  if (!scene.textures.exists(WATER_BG_KEY)) scene.load.image(WATER_BG_KEY, 'art/water-bg.png')
}
