import Phaser from 'phaser'

const FLESH = ['#ef5b60', '#ffd4d8', '#ffbc62', '#fff0cc', '#ffd77d', '#f6db6d']
const RIND = ['#539960', '#d94356', '#e8892e', '#cc5b4c', '#e69c88', '#b59a45']
let serial = 0

/** 烘焙成真正的半张透明图片，切面、果皮和旋转一起飞散，不使用固定世界遮罩。 */
export function makeCutHalf(scene: Phaser.Scene, key: string | null, fallback: string, kind: number, rotation: number, angle: number, side: number): Phaser.GameObjects.Image {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const tx = Math.cos(angle), ty = Math.sin(angle), nx = -ty, ny = tx
  ctx.translate(64, 64)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(-tx * 64, -ty * 64)
  ctx.lineTo(tx * 64, ty * 64)
  ctx.lineTo(tx * 64 + nx * 128 * side, ty * 64 + ny * 128 * side)
  ctx.lineTo(-tx * 64 + nx * 128 * side, -ty * 64 + ny * 128 * side)
  ctx.closePath(); ctx.clip()
  ctx.rotate(rotation)
  if (key) ctx.drawImage(scene.textures.get(key).getSourceImage() as CanvasImageSource, -46, -46, 92, 92)
  else { ctx.font = '68px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fallback, 0, 0) }
  ctx.restore()
  ctx.save()
  ctx.rotate(angle)
  // 果肉是可见椭圆截面，不是贴在整果上的一条彩色带。
  ctx.fillStyle = RIND[kind] ?? RIND[0]!
  ctx.beginPath(); ctx.ellipse(0, side * 3, 42, 12, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = FLESH[kind] ?? FLESH[0]!
  ctx.beginPath(); ctx.ellipse(0, side * 3, 38, 9, 0, 0, Math.PI * 2); ctx.fill()
  if (kind === 2) {
    ctx.strokeStyle = '#ffe8ad'; ctx.lineWidth = 1.5
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, side * 3); ctx.lineTo(i * 14, side * 3 + (i % 2 ? 7 : -7)); ctx.stroke() }
  } else {
    ctx.fillStyle = kind === 1 || kind === 5 ? '#ba903f' : '#64452d'
    const count = kind === 4 ? 1 : kind === 3 ? 2 : 5
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0 : (i / (count - 1) - 0.5) * 48
      ctx.beginPath(); ctx.ellipse(x, side * 3, kind === 4 ? 9 : 2, kind === 4 ? 5 : 3, 0.3, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
  const textureKey = `cut-half-${serial++}`
  const textures = scene.textures
  textures.addCanvas(textureKey, canvas)
  const image = scene.add.image(0, 0, textureKey)
  image.once('destroy', () => { if (textures.exists(textureKey)) textures.remove(textureKey) })
  return image
}
