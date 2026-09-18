import Phaser from 'phaser'

export interface HeaderButtonConfig {
  /** 锚点 x；anchor 为 right 时指向按钮右边缘，left 时指向左边缘 */
  x: number
  /** 按钮中心的 y */
  y: number
  label: string
  onTap: () => void
  enabled?: boolean
  anchor?: 'left' | 'center' | 'right'
  /** light 配米白纸面（2048/五子棋等），dark 配深绿头部（纸牌类） */
  tone?: 'light' | 'dark'
}

const BUTTON_HEIGHT = 44

// 头部动作按钮统一做成 ≥44px 的药丸，满足孩子的手指触控；
// 返回按钮宽度，方便调用方以 anchor: 'right' 连续向左排布。
export function createHeaderButton(scene: Phaser.Scene, config: HeaderButtonConfig): number {
  const enabled = config.enabled ?? true
  const anchor = config.anchor ?? 'center'
  const tone = config.tone ?? 'light'
  const text = scene.add.text(0, 0, config.label, {
    color: enabled
      ? (tone === 'dark' ? '#173f35' : '#cb6544')
      : (tone === 'dark' ? '#9fc0b2' : '#b0a695'),
    fontFamily: 'Avenir Next, PingFang SC, sans-serif',
    fontSize: '17px', fontStyle: 'bold'
  }).setOrigin(0.5)
  const width = Math.max(64, text.width + 34)
  let x = config.x
  if (anchor === 'right') x -= width / 2
  if (anchor === 'left') x += width / 2

  const background = scene.add.graphics({ x, y: config.y })
  background.fillStyle(tone === 'dark' ? (enabled ? 0xfff6dd : 0x3f5c4c) : (enabled ? 0xfffdf6 : 0xe4dccb))
  background.fillRoundedRect(-width / 2, -BUTTON_HEIGHT / 2, width, BUTTON_HEIGHT, 12)
  background.lineStyle(1.5, tone === 'dark' ? 0xfff6dd : 0xd8dfd4, tone === 'dark' ? 0.55 : 1)
  background.strokeRoundedRect(-width / 2, -BUTTON_HEIGHT / 2, width, BUTTON_HEIGHT, 12)
  background.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -BUTTON_HEIGHT / 2, width, BUTTON_HEIGHT), Phaser.Geom.Rectangle.Contains)
    .on('pointerup', () => { if (enabled) config.onTap() })
  text.setPosition(x, config.y)
  scene.children.bringToTop(text)
  return width
}
