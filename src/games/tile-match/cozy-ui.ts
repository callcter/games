import Phaser from 'phaser'

export const COZY = {
  forest: 0x285c50,
  forestDark: 0x19483f,
  cream: 0xfff8df,
  creamLight: 0xfffff4,
  honey: 0xe7b45e,
  honeyDark: 0xb67a35,
  coral: 0xe8755f,
  cocoa: 0x684a34,
  sage: 0x92ad79
} as const

export type CozyIconName =
  | 'back'
  | 'sound'
  | 'muted'
  | 'undo'
  | 'shuffle'
  | 'restart'

function drawIcon(g: Phaser.GameObjects.Graphics, name: CozyIconName, color = COZY.forestDark): void {
  g.clear()
  g.lineStyle(4, color, 1)

  switch (name) {
    case 'back':
      g.beginPath()
      g.moveTo(7, -11)
      g.lineTo(-6, 0)
      g.lineTo(7, 11)
      g.strokePath()
      break
    case 'sound':
      g.fillStyle(color, 1)
      g.fillRect(-13, -5, 7, 10)
      g.beginPath()
      g.moveTo(-6, -6)
      g.lineTo(4, -14)
      g.lineTo(4, 14)
      g.lineTo(-6, 6)
      g.closePath()
      g.fillPath()
      g.beginPath()
      g.arc(5, 0, 9, -0.8, 0.8)
      g.strokePath()
      g.beginPath()
      g.arc(6, 0, 15, -0.65, 0.65)
      g.strokePath()
      break
    case 'muted':
      drawIcon(g, 'sound', color)
      g.lineStyle(4.5, COZY.coral, 1)
      g.beginPath(); g.moveTo(11, -11); g.lineTo(22, 11); g.strokePath()
      g.beginPath(); g.moveTo(22, -11); g.lineTo(11, 11); g.strokePath()
      break
    case 'undo':
      g.beginPath()
      g.arc(2, 1, 12, -2.7, 1.0)
      g.strokePath()
      g.beginPath()
      g.moveTo(-13, -11)
      g.lineTo(-14, 2)
      g.lineTo(-2, -4)
      g.strokePath()
      break
    case 'shuffle':
      g.beginPath()
      g.moveTo(-15, -8); g.lineTo(-7, -8); g.lineTo(10, 9); g.lineTo(17, 9); g.strokePath()
      g.beginPath()
      g.moveTo(10, 3); g.lineTo(17, 9); g.lineTo(10, 15); g.strokePath()
      g.beginPath()
      g.moveTo(-15, 9); g.lineTo(-7, 9); g.lineTo(-2, 4); g.strokePath()
      g.beginPath()
      g.moveTo(3, -1); g.lineTo(10, -8); g.lineTo(17, -8); g.strokePath()
      g.beginPath()
      g.moveTo(10, -14); g.lineTo(17, -8); g.lineTo(10, -2); g.strokePath()
      break
    case 'restart':
      g.beginPath()
      g.arc(0, 0, 13, -1.9, 4.3)
      g.strokePath()
      g.beginPath()
      g.moveTo(-10, -13)
      g.lineTo(-15, -2)
      g.lineTo(-3, -4)
      g.strokePath()
      break
  }
}

export interface CozyIconButton {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setBadge(value?: number): void
  setIcon(icon: CozyIconName): void
  setEnabled(enabled: boolean): void
}

export function createCozyIconButton(
  scene: Phaser.Scene,
  icon: CozyIconName,
  action: () => void,
  radius = 34
): CozyIconButton {
  const container = scene.add.container(0, 0).setDepth(350)
  const shadow = scene.add.graphics()
  const face = scene.add.graphics()
  const glyph = scene.add.graphics()
  const badge = scene.add.container(radius * 0.72, radius * 0.72).setVisible(false)
  const badgeBg = scene.add.graphics()
  const badgeText = scene.add.text(0, 0, '', {
    fontFamily: 'Avenir Next, PingFang SC, sans-serif',
    fontSize: '13px',
    color: '#fffdf6',
    fontStyle: 'bold'
  }).setOrigin(0.5)
  badge.add([badgeBg, badgeText])
  container.add([shadow, face, glyph, badge])

  let currentIcon = icon
  let enabled = true

  const paint = (pressed = false): void => {
    shadow.clear()
    shadow.fillStyle(COZY.cocoa, 0.25)
    shadow.fillCircle(0, 6, radius + 1)

    face.clear()
    face.fillStyle(pressed ? 0xf4e8c6 : COZY.creamLight, 1)
    face.fillCircle(0, pressed ? 3 : 0, radius)
    face.lineStyle(3, COZY.honey, 0.72)
    face.strokeCircle(0, pressed ? 3 : 0, radius - 1)

    drawIcon(glyph, currentIcon)
    glyph.y = pressed ? 3 : 0
  }
  paint()

  container.setSize(radius * 2, radius * 2)
  // Phaser 4 Container displayOrigin = size/2：hitArea 以左上角为原点。
  container.setInteractive(new Phaser.Geom.Circle(radius + 4, radius + 4, radius + 4), Phaser.Geom.Circle.Contains)
  container.on('pointerdown', () => {
    if (!enabled) return
    paint(true)
    scene.tweens.add({ targets: container, scale: 0.95, duration: 55, ease: 'Sine.Out' })
  })
  container.on('pointerup', () => {
    if (!enabled) return
    paint(false)
    scene.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Back.Out' })
    action()
  })
  container.on('pointerout', () => {
    paint(false)
    container.setScale(1)
  })

  return {
    container,
    setPosition(x: number, y: number) {
      container.setPosition(x, y)
    },
    setBadge(value?: number) {
      if (value === undefined) {
        badge.setVisible(false)
        return
      }
      badgeBg.clear()
      badgeBg.fillStyle(value > 0 ? COZY.forest : 0x998c7c, 1)
      badgeBg.fillCircle(0, 0, 13)
      badgeBg.lineStyle(2, COZY.creamLight, 1)
      badgeBg.strokeCircle(0, 0, 12)
      badgeText.setText(String(value))
      badge.setVisible(true)
    },
    setIcon(next: CozyIconName) {
      currentIcon = next
      paint(false)
    },
    setEnabled(next: boolean) {
      enabled = next
      container.setAlpha(next ? 1 : 0.45)
      if (container.input) container.input.enabled = next
    }
  }
}

export interface CozyPillButton {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setLabel(label: string): void
}

export function createCozyPillButton(
  scene: Phaser.Scene,
  label: string,
  action: () => void
): CozyPillButton {
  const container = scene.add.container(0, 0).setDepth(350)
  const shadow = scene.add.graphics()
  const face = scene.add.graphics()
  const leaf = scene.add.graphics()
  const text = scene.add.text(8, 0, label, {
    fontFamily: 'Avenir Next, PingFang SC, sans-serif',
    fontSize: '20px',
    color: '#fffdf6',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  const paint = (pressed = false): void => {
    shadow.clear()
    shadow.fillStyle(COZY.forestDark, 0.28)
    shadow.fillRoundedRect(-78, -24 + 6, 156, 52, 25)

    face.clear()
    face.fillStyle(pressed ? COZY.forestDark : COZY.forest, 0.98)
    face.fillRoundedRect(-78, -26 + (pressed ? 4 : 0), 156, 52, 25)
    face.lineStyle(2, 0xffffff, 0.16)
    face.strokeRoundedRect(-76, -24 + (pressed ? 4 : 0), 152, 48, 23)

    leaf.clear()
    leaf.fillStyle(COZY.honey, 1)
    leaf.fillEllipse(-57, -1 + (pressed ? 4 : 0), 20, 12)
    leaf.rotation = -0.45
    text.y = pressed ? 4 : 0
  }
  paint()

  container.add([shadow, face, leaf, text])
  container.setSize(156, 52)
  container.setInteractive(new Phaser.Geom.Rectangle(0, 0, 156, 52), Phaser.Geom.Rectangle.Contains)
  container.on('pointerdown', () => { paint(true); container.setScale(0.97) })
  container.on('pointerup', () => {
    paint(false)
    scene.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Back.Out' })
    action()
  })
  container.on('pointerout', () => { paint(false); container.setScale(1) })

  return {
    container,
    setPosition(x: number, y: number) { container.setPosition(x, y) },
    setLabel(next: string) { text.setText(next) }
  }
}
