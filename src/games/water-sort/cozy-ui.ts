import Phaser from 'phaser'

export const WATER_UI = {
  forest: 0x285c50,
  forestDark: 0x19483f,
  cream: 0xfff6dc,
  creamLight: 0xfffff4,
  honey: 0xe6b762,
  honeyDark: 0xb47b39,
  cocoa: 0x6b4b35,
  coral: 0xe87562,
  sky: 0x66bfe3,
  sage: 0x8eb478
} as const

export type WaterIcon =
  | 'back'
  | 'sound'
  | 'muted'
  | 'undo'
  | 'hint'
  | 'new'

function drawIcon(g: Phaser.GameObjects.Graphics, icon: WaterIcon, color = WATER_UI.forestDark): void {
  g.clear()
  g.lineStyle(4, color, 1)

  switch (icon) {
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
      g.lineTo(3, -13)
      g.lineTo(3, 13)
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
      g.lineStyle(4.5, WATER_UI.coral, 1)
      g.beginPath(); g.moveTo(10, -11); g.lineTo(21, 11); g.strokePath()
      g.beginPath(); g.moveTo(21, -11); g.lineTo(10, 11); g.strokePath()
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

    case 'hint':
      g.beginPath()
      g.arc(0, -3, 10, Math.PI * 0.08, Math.PI * 1.92)
      g.strokePath()
      g.beginPath()
      g.moveTo(-5, 8); g.lineTo(5, 8); g.strokePath()
      g.beginPath()
      g.moveTo(-4, 13); g.lineTo(4, 13); g.strokePath()
      break

    case 'new':
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

export interface RoundButton {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setIcon(icon: WaterIcon): void
  setEnabled(enabled: boolean): void
}

export function createRoundButton(
  scene: Phaser.Scene,
  icon: WaterIcon,
  action: () => void,
  radius = 34
): RoundButton {
  const container = scene.add.container(0, 0).setDepth(400)
  const shadow = scene.add.graphics()
  const face = scene.add.graphics()
  const glyph = scene.add.graphics()
  container.add([shadow, face, glyph])

  let current = icon
  let enabled = true

  const paint = (pressed = false): void => {
    shadow.clear()
    shadow.fillStyle(WATER_UI.cocoa, 0.26)
    shadow.fillCircle(0, 7, radius + 1)

    face.clear()
    face.fillStyle(pressed ? 0xf0e1bb : WATER_UI.creamLight, 1)
    face.fillCircle(0, pressed ? 4 : 0, radius)
    face.lineStyle(3, WATER_UI.honey, 0.82)
    face.strokeCircle(0, pressed ? 4 : 0, radius - 1)

    drawIcon(glyph, current)
    glyph.y = pressed ? 4 : 0
  }

  paint()
  container.setSize(radius * 2, radius * 2)
  // Phaser 4 Container displayOrigin = size/2：hitArea 以左上角为原点。
  container.setInteractive(new Phaser.Geom.Circle(radius + 6, radius + 6, radius + 6), Phaser.Geom.Circle.Contains)
  container
    .on('pointerdown', () => {
      if (!enabled) return
      paint(true)
      container.setScale(0.95)
    })
    .on('pointerup', () => {
      if (!enabled) return
      paint(false)
      scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Back.Out' })
      action()
    })
    .on('pointerout', () => {
      paint(false)
      container.setScale(1)
    })

  return {
    container,
    setPosition(x: number, y: number) { container.setPosition(x, y) },
    setIcon(next: WaterIcon) { current = next; paint(false) },
    setEnabled(next: boolean) {
      enabled = next
      container.setAlpha(next ? 1 : 0.46)
      if (container.input) container.input.enabled = next
    }
  }
}

export interface ToolButton {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setEnabled(enabled: boolean): void
}

export function createToolButton(
  scene: Phaser.Scene,
  icon: WaterIcon,
  label: string,
  action: () => void
): ToolButton {
  const container = scene.add.container(0, 0).setDepth(400)
  const shadow = scene.add.graphics()
  const face = scene.add.graphics()
  const glyph = scene.add.graphics()
  const text = scene.add.text(16, 1, label, {
    fontFamily: 'Avenir Next, PingFang SC, sans-serif',
    fontSize: '18px',
    color: '#285c50',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  container.add([shadow, face, glyph, text])
  let enabled = true

  const paint = (pressed = false): void => {
    shadow.clear()
    shadow.fillStyle(WATER_UI.cocoa, 0.25)
    shadow.fillRoundedRect(-74, -27 + 7, 148, 58, 22)

    face.clear()
    face.fillStyle(pressed ? 0xf0e1bb : WATER_UI.creamLight, 1)
    face.fillRoundedRect(-74, -29 + (pressed ? 4 : 0), 148, 58, 22)
    face.lineStyle(2.5, WATER_UI.honey, 0.78)
    face.strokeRoundedRect(-72, -27 + (pressed ? 4 : 0), 144, 54, 20)

    drawIcon(glyph, icon)
    glyph.setPosition(-43, pressed ? 4 : 0)
    text.y = pressed ? 5 : 1
  }

  paint()
  container.setSize(148, 58)
  container.setInteractive(new Phaser.Geom.Rectangle(0, 0, 148, 58), Phaser.Geom.Rectangle.Contains)
  container
    .on('pointerdown', () => {
      if (!enabled) return
      paint(true)
      container.setScale(0.97)
    })
    .on('pointerup', () => {
      if (!enabled) return
      paint(false)
      scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Back.Out' })
      action()
    })
    .on('pointerout', () => {
      paint(false)
      container.setScale(1)
    })

  return {
    container,
    setPosition(x: number, y: number) { container.setPosition(x, y) },
    setEnabled(next: boolean) {
      enabled = next
      container.setAlpha(next ? 1 : 0.46)
      if (container.input) container.input.enabled = next
    }
  }
}

export interface ModePill {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setLabel(label: string): void
}

export function createModePill(
  scene: Phaser.Scene,
  label: string,
  action: () => void
): ModePill {
  const container = scene.add.container(0, 0).setDepth(400)
  const shadow = scene.add.graphics()
  const face = scene.add.graphics()
  const leaf = scene.add.graphics()
  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Avenir Next, PingFang SC, sans-serif',
    fontSize: '20px',
    color: '#fffdf6',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  const paint = (pressed = false): void => {
    shadow.clear()
    shadow.fillStyle(WATER_UI.forestDark, 0.28)
    shadow.fillRoundedRect(-78, -24 + 7, 156, 52, 25)

    face.clear()
    face.fillStyle(pressed ? WATER_UI.forestDark : WATER_UI.forest, 0.98)
    face.fillRoundedRect(-78, -26 + (pressed ? 4 : 0), 156, 52, 25)
    face.lineStyle(2, 0xffffff, 0.14)
    face.strokeRoundedRect(-76, -24 + (pressed ? 4 : 0), 152, 48, 23)

    leaf.clear()
    leaf.fillStyle(WATER_UI.honey, 1)
    leaf.fillEllipse(-57, -1 + (pressed ? 4 : 0), 20, 11)
    text.y = pressed ? 4 : 0
  }

  paint()
  container.add([shadow, face, leaf, text])
  container.setSize(156, 52)
  container.setInteractive(new Phaser.Geom.Rectangle(0, 0, 156, 52), Phaser.Geom.Rectangle.Contains)
  container
    .on('pointerdown', () => { paint(true); container.setScale(0.97) })
    .on('pointerup', () => {
      paint(false)
      scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Back.Out' })
      action()
    })
    .on('pointerout', () => { paint(false); container.setScale(1) })

  return {
    container,
    setPosition(x: number, y: number) { container.setPosition(x, y) },
    setLabel(next: string) { text.setText(next) }
  }
}

export interface StatChip {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setText(value: string): void
}

export function createStatChip(scene: Phaser.Scene, value: string): StatChip {
  const container = scene.add.container(0, 0).setDepth(350)
  const shadow = scene.add.graphics()
  shadow.fillStyle(WATER_UI.cocoa, 0.17)
  shadow.fillRoundedRect(-55, -18 + 4, 110, 38, 18)
  const face = scene.add.graphics()
  face.fillStyle(WATER_UI.creamLight, 0.91)
  face.fillRoundedRect(-55, -20, 110, 38, 18)
  face.lineStyle(1.5, WATER_UI.honey, 0.56)
  face.strokeRoundedRect(-54, -19, 108, 36, 17)
  const text = scene.add.text(0, -1, value, {
    fontFamily: 'Avenir Next, PingFang SC, sans-serif',
    fontSize: '16px',
    color: '#5a4939',
    fontStyle: 'bold'
  }).setOrigin(0.5)
  container.add([shadow, face, text])

  return {
    container,
    setPosition(x: number, y: number) { container.setPosition(x, y) },
    setText(next: string) { text.setText(next) }
  }
}
