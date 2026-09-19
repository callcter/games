import Phaser from 'phaser'

export const PRODUCT_V3 = {
  parking: {
    background: 'product-v3-parking-bg',
    vehicles: 'product-v3-parking-vehicles'
  },
  memory: {
    setA: 'product-v3-memory-a',
    setB: 'product-v3-memory-b'
  },
  bubbles: {
    background: 'product-v3-bubbles-bg',
    bubbles: 'product-v3-bubbles'
  },
  sokoban: {
    sprites: 'product-v3-sokoban'
  },
  cards: {
    table: 'product-v3-cards-table',
    back: 'product-v3-card-back'
  }
} as const

function image(scene: Phaser.Scene, key: string, path: string): void {
  if (!scene.textures.exists(key)) scene.load.image(key, path)
}

function sheet(
  scene: Phaser.Scene,
  key: string,
  path: string,
  frameWidth: number,
  frameHeight: number
): void {
  if (!scene.textures.exists(key)) {
    scene.load.spritesheet(key, path, { frameWidth, frameHeight })
  }
}

export function preloadParkingV3(scene: Phaser.Scene): void {
  image(scene, PRODUCT_V3.parking.background, 'art/product-v3/backgrounds/parking.png')
  sheet(scene, PRODUCT_V3.parking.vehicles, 'art/product-v3/sprites/parking-vehicles.png', 512, 512)
}

export function preloadMemoryV3(scene: Phaser.Scene): void {
  sheet(scene, PRODUCT_V3.memory.setA, 'art/product-v3/sprites/memory-set-a.png', 256, 256)
  sheet(scene, PRODUCT_V3.memory.setB, 'art/product-v3/sprites/memory-set-b.png', 256, 256)
}

export function preloadBubblesV3(scene: Phaser.Scene): void {
  image(scene, PRODUCT_V3.bubbles.background, 'art/product-v3/backgrounds/bubbles.png')
  sheet(scene, PRODUCT_V3.bubbles.bubbles, 'art/product-v3/sprites/bubbles.png', 384, 384)
}

export function preloadSokobanV3(scene: Phaser.Scene): void {
  sheet(scene, PRODUCT_V3.sokoban.sprites, 'art/product-v3/sprites/sokoban.png', 512, 512)
}

export function preloadCardsV3(scene: Phaser.Scene): void {
  image(scene, PRODUCT_V3.cards.table, 'art/product-v3/backgrounds/cards-table.png')
  image(scene, PRODUCT_V3.cards.back, 'art/product-v3/sprites/card-back.png')
}

export function addCoverImage(
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
