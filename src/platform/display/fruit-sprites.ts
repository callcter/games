import Phaser from 'phaser'

/**
 * 共享水果精灵图：合成水果与切水果共用同一套 GPT Image 生成的素材。
 * 两张 3 列 × 2 行、1254×1254 的精灵图（帧 418×627），白底生成，
 * 加载后用四角洪水填充把边缘白底转透明（保护素材内部的白色高光）。
 * 帧序：小图 = 樱桃/草莓/葡萄/凸顶柑/柿子/苹果（等级 0-5），
 * 大图 = 梨/桃子/菠萝/蜜瓜/西瓜/炸弹（等级 6-10，炸弹 = BOMB_FRAME）。
 */
export const FRUIT_SHEETS = [
  { key: 'fruit-sheet-a', url: 'art/fruits-small.png' },
  { key: 'fruit-sheet-b', url: 'art/fruits-big.png' }
] as const
export const BOMB_FRAME = 5

export function preloadFruitSheets(scene: Phaser.Scene): void {
  for (const sheet of FRUIT_SHEETS) {
    if (!scene.textures.exists(sheet.key)) scene.load.spritesheet(sheet.key, sheet.url, { frameWidth: 418, frameHeight: 627 })
  }
}

/** 素材是否已加载并完成去底；失败时调用方回退程序化绘制。 */
export function fruitSheetsReady(scene: Phaser.Scene): boolean {
  return FRUIT_SHEETS.every(sheet => scene.textures.exists(transparentKey(sheet.key)))
}

/** 等级（0-10）或炸弹（传负数）对应去底后的纹理与帧号。 */
export function fruitFrame(level: number): { key: string; frame: number } {
  if (level < 0) return { key: transparentKey(FRUIT_SHEETS[1]!.key), frame: BOMB_FRAME }
  const sheet = level >= 6 ? FRUIT_SHEETS[1]! : FRUIT_SHEETS[0]!
  return { key: transparentKey(sheet.key), frame: level >= 6 ? level - 6 : level }
}

/** 把精灵图边缘白底转成透明并注册新纹理；重复调用安全。 */
export function makeTransparentFruitSheets(scene: Phaser.Scene): void {
  for (const sheet of FRUIT_SHEETS) {
    const target = transparentKey(sheet.key)
    if (scene.textures.exists(target) || !scene.textures.exists(sheet.key)) continue
    const source = scene.textures.get(sheet.key).getSourceImage() as CanvasImageSource
    const canvas = document.createElement('canvas')
    canvas.width = (source as HTMLImageElement).naturalWidth || (source as HTMLCanvasElement).width
    canvas.height = (source as HTMLImageElement).naturalHeight || (source as HTMLCanvasElement).height
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.drawImage(source, 0, 0)
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = image.data
    const width = canvas.width
    const nearWhite = (i: number) => data[i]! >= 240 && data[i + 1]! >= 240 && data[i + 2]! >= 240
    // 四角洪水填充：只清掉与边缘连通的白色，素材内部的白色高光保留。
    const visited = new Uint8Array(width * canvas.height)
    const queue: number[] = []
    const seed = (x: number, y: number) => {
      const pixel = y * width + x
      if (visited[pixel]) return
      visited[pixel] = 1
      queue.push(pixel)
    }
    seed(0, 0); seed(width - 1, 0); seed(0, canvas.height - 1); seed(width - 1, canvas.height - 1)
    while (queue.length) {
      const pixel = queue.pop()!
      const x = pixel % width
      const y = (pixel - x) / width
      const i = pixel * 4
      if (!nearWhite(i)) continue
      data[i + 3] = 0
      if (x > 0) seed(x - 1, y)
      if (x < width - 1) seed(x + 1, y)
      if (y > 0) seed(x, y - 1)
      if (y < canvas.height - 1) seed(x, y + 1)
    }
    ctx.putImageData(image, 0, 0)
    scene.textures.addCanvas(target, canvas)
  }
}

function transparentKey(key: string): string {
  return `${key}-art`
}

/**
 * 把去底后的每帧按非透明范围裁剪、居中画到正方形纹理 fruit-art-{0..10}
 * 与 fruit-art-bomb，供显示尺寸直接映射物理直径。返回素材是否可用，
 * 失败时调用方回退程序化绘制。重复调用安全。
 */
export function ensureFruitArtFrames(scene: Phaser.Scene): boolean {
  if (scene.textures.exists('fruit-art-10')) return true
  makeTransparentFruitSheets(scene)
  for (const sheet of FRUIT_SHEETS) {
    if (!scene.textures.exists(transparentKey(sheet.key))) return false
  }
  for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1]) {
    if (scene.textures.exists(artKey(level))) continue
    const position = fruitFrame(level)
    const source = scene.textures.get(position.key).getSourceImage() as HTMLCanvasElement
    const frameX = (position.frame % 3) * 418
    const frameY = Math.floor(position.frame / 3) * 627
    const ctx = source.getContext('2d')
    if (!ctx) return false
    const region = ctx.getImageData(frameX, frameY, 418, 627)
    let minX = 418, minY = 627, maxX = -1, maxY = -1
    for (let y = 0; y < 627; y++) {
      for (let x = 0; x < 418; x++) {
        if (region.data[(y * 418 + x) * 4 + 3]! > 24) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return false
    const size = Math.max(maxX - minX + 1, maxY - minY + 1)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    canvas.getContext('2d')?.drawImage(source, frameX + minX, frameY + minY, maxX - minX + 1, maxY - minY + 1, (size - (maxX - minX + 1)) / 2, (size - (maxY - minY + 1)) / 2, maxX - minX + 1, maxY - minY + 1)
    scene.textures.addCanvas(artKey(level), canvas)
  }
  return true
}

export function fruitArtKey(level: number): string {
  return artKey(level)
}

function artKey(level: number): string {
  return level < 0 ? 'fruit-art-bomb' : `fruit-art-${level}`
}
