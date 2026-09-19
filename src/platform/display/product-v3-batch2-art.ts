import Phaser from 'phaser'

export const PRODUCT_V3_BATCH2 = {
  maze: {
    sprites: 'product-v3-b2-maze'
  },
  mergeFruit: {
    background: 'product-v3-b2-merge-fruit-bg'
  },
  fruitSlicer: {
    background: 'product-v3-b2-fruit-slicer-bg'
  }
} as const

function loadImage(scene: Phaser.Scene, key: string, path: string): void {
  if (!scene.textures.exists(key)) scene.load.image(key, path)
}

export function preloadMazeBatch2(scene: Phaser.Scene): void {
  if (!scene.textures.exists(PRODUCT_V3_BATCH2.maze.sprites)) {
    scene.load.spritesheet(
      PRODUCT_V3_BATCH2.maze.sprites,
      'art/product-v3-batch2/sprites/maze.png',
      { frameWidth: 512, frameHeight: 512 }
    )
  }
}

export function preloadMergeFruitBatch2(scene: Phaser.Scene): void {
  loadImage(
    scene,
    PRODUCT_V3_BATCH2.mergeFruit.background,
    'art/product-v3-batch2/backgrounds/merge-fruit.png'
  )
}

export function preloadFruitSlicerBatch2(scene: Phaser.Scene): void {
  loadImage(
    scene,
    PRODUCT_V3_BATCH2.fruitSlicer.background,
    'art/product-v3-batch2/backgrounds/fruit-slicer.png'
  )
}

export function addBatch2Cover(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  depth = -100,
  alpha = 1
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null
  const source = scene.textures.get(key).source[0]
  if (!source?.width || !source?.height) return null

  const cover = Math.max(width / source.width, height / source.height)
  return scene.add.image(width / 2, height / 2, key)
    .setDisplaySize(source.width * cover, source.height * cover)
    .setDepth(depth)
    .setAlpha(alpha)
}
