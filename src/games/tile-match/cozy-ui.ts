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
  sage: 0x92ad79,
  ink: 0x244c43
} as const

const FONT = 'Avenir Next, PingFang SC, sans-serif'

export type CozyIconName =
  | 'back'
  | 'sound'
  | 'muted'
  | 'undo'
  | 'shuffle'
  | 'restart'

function drawIcon(g: Phaser.GameObjects.Graphics, name: CozyIconName, color = COZY.forestDark): void {
  g.clear()
  g.lineStyle(3.6, color, 1)

  switch (name) {
    case 'back':
      g.beginPath()
      g.moveTo(7, -11)
      g.lineTo(-7, 0)
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
      g.arc(5, 0, 9, -0.78, 0.78)
      g.strokePath()
      g.beginPath()
      g.arc(6, 0, 15, -0.62, 0.62)
      g.strokePath()
      break

    case 'muted':
      drawIcon(g, 'sound', color)
      g.lineStyle(4.2, COZY.coral, 1)
      g.beginPath()
      g.moveTo(10, -10)
      g.lineTo(21, 10)
      g.strokePath()
      g.beginPath()
      g.moveTo(21, -10)
      g.lineTo(10, 10)
      g.strokePath()
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
      g.moveTo(-15, -8)
      g.lineTo(-7, -8)
      g.lineTo(10, 9)
      g.lineTo(17, 9)
      g.strokePath()
      g.beginPath()
      g.moveTo(10, 3)
      g.lineTo(17, 9)
      g.lineTo(10, 15)
      g.strokePath()
      g.beginPath()
      g.moveTo(-15, 9)
      g.lineTo(-7, 9)
      g.lineTo(-2, 4)
      g.strokePath()
      g.beginPath()
      g.moveTo(3, -1)
      g.lineTo(10, -8)
      g.lineTo(17, -8)
      g.strokePath()
      g.beginPath()
      g.moveTo(10, -14)
      g.lineTo(17, -8)
      g.lineTo(10, -2)
      g.strokePath()
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
  setIcon(icon: CozyIconName): void
  setEnabled(enabled: boolean): void
}

export function createCozyIconButton(
  scene: Phaser.Scene,
  icon: CozyIconName,
  action: () => void,
  radius = 31
): CozyIconButton {
  const container = scene.add.container(0, 0).setDepth(350)
  const shadow = scene.add.graphics()
  const rim = scene.add.graphics()
  const face = scene.add.graphics()
  const glyph = scene.add.graphics()
  container.add([shadow, rim, face, glyph])

  let currentIcon = icon
  let enabled = true

  const paint = (pressed = false): void => {
    const push = pressed ? 4 : 0

    shadow.clear()
    shadow.fillStyle(COZY.cocoa, 0.26)
    shadow.fillCircle(0, 6, radius + 1)

    rim.clear()
    rim.fillStyle(COZY.honeyDark, 0.94)
    rim.fillCircle(0, push + 2, radius)

    face.clear()
    face.fillStyle(pressed ? 0xf5e9c9 : COZY.creamLight, 1)
    face.fillCircle(0, push - 2, radius - 3)
    face.lineStyle(1.6, 0xffffff, 0.72)
    face.strokeCircle(0, push - 2, radius - 5)

    drawIcon(glyph, currentIcon)
    glyph.y = push - 2
  }

  paint()

  container.setSize(radius * 2, radius * 2)
  // Phaser 4 Container 的 hitArea 坐标以 displayOrigin 后的局部左上为基准。
  container.setInteractive(
    new Phaser.Geom.Circle(radius + 4, radius + 4, radius + 4),
    Phaser.Geom.Circle.Contains
  )

  container.on('pointerdown', () => {
    if (!enabled) return
    paint(true)
    scene.tweens.add({ targets: container, scale: 0.96, duration: 55, ease: 'Sine.Out' })
  })

  container.on('pointerup', () => {
    if (!enabled) return
    paint(false)
    scene.tweens.add({ targets: container, scale: 1, duration: 115, ease: 'Back.Out' })
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
    setIcon(next: CozyIconName) {
      currentIcon = next
      paint(false)
    },
    setEnabled(next: boolean) {
      enabled = next
      container.setAlpha(next ? 1 : 0.46)
      if (container.input) container.input.enabled = next
    }
  }
}

export interface CozyToolButton {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setBadge(value?: number): void
  setEnabled(enabled: boolean): void
}

/**
 * 底部工具按钮不用“白圆圈 + Unicode”：
 * 统一为带文字的实体工具胶囊，让孩子和成人都能一眼看懂撤销/洗牌/重开。
 */
export function createCozyToolButton(
  scene: Phaser.Scene,
  icon: Extract<CozyIconName, 'undo' | 'shuffle' | 'restart'>,
  label: string,
  action: () => void
): CozyToolButton {
  const WIDTH = 142
  const HEIGHT = 62
  const container = scene.add.container(0, 0).setDepth(350)

  const shadow = scene.add.graphics()
  const rim = scene.add.graphics()
  const face = scene.add.graphics()
  const glyph = scene.add.graphics().setPosition(-38, -1)
  const text = scene.add.text(18, -1, label, {
    fontFamily: FONT,
    fontSize: '18px',
    color: '#244c43',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  const badge = scene.add.container(WIDTH / 2 - 8, -HEIGHT / 2 + 5).setVisible(false)
  const badgeShadow = scene.add.graphics()
  const badgeBg = scene.add.graphics()
  const badgeText = scene.add.text(0, 0, '', {
    fontFamily: FONT,
    fontSize: '14px',
    color: '#fffdf6',
    fontStyle: 'bold'
  }).setOrigin(0.5)
  badge.add([badgeShadow, badgeBg, badgeText])

  container.add([shadow, rim, face, glyph, text, badge])

  let enabled = true

  const paint = (pressed = false): void => {
    const push = pressed ? 4 : 0

    shadow.clear()
    shadow.fillStyle(COZY.cocoa, 0.23)
    shadow.fillRoundedRect(-WIDTH / 2, -HEIGHT / 2 + 7, WIDTH, HEIGHT, 22)

    rim.clear()
    rim.fillStyle(COZY.honeyDark, 0.93)
    rim.fillRoundedRect(-WIDTH / 2, -HEIGHT / 2 + push + 3, WIDTH, HEIGHT - 1, 22)

    face.clear()
    face.fillStyle(pressed ? 0xf2e5c2 : COZY.creamLight, 1)
    face.fillRoundedRect(-WIDTH / 2 + 3, -HEIGHT / 2 + push, WIDTH - 6, HEIGHT - 7, 19)
    face.lineStyle(1.6, 0xffffff, 0.72)
    face.strokeRoundedRect(-WIDTH / 2 + 5, -HEIGHT / 2 + push + 2, WIDTH - 10, HEIGHT - 11, 17)

    glyph.y = push - 1
    text.y = push - 1
    drawIcon(glyph, icon)
  }

  paint()

  container.setSize(WIDTH, HEIGHT)
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, WIDTH, HEIGHT),
    Phaser.Geom.Rectangle.Contains
  )

  container.on('pointerdown', () => {
    if (!enabled) return
    paint(true)
    scene.tweens.add({ targets: container, scale: 0.98, duration: 55, ease: 'Sine.Out' })
  })

  container.on('pointerup', () => {
    if (!enabled) return
    paint(false)
    scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Back.Out' })
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

      badgeShadow.clear()
      badgeShadow.fillStyle(COZY.cocoa, 0.30)
      badgeShadow.fillCircle(0, 3, 17)

      badgeBg.clear()
      badgeBg.fillStyle(value > 0 ? COZY.forest : 0x9a8d7c, 1)
      badgeBg.fillCircle(0, 0, 16)
      badgeBg.lineStyle(2.2, COZY.creamLight, 1)
      badgeBg.strokeCircle(0, 0, 15)

      badgeText.setText(String(value))
      badge.setVisible(true)
    },
    setEnabled(next: boolean) {
      enabled = next
      container.setAlpha(next ? 1 : 0.46)
      if (container.input) container.input.enabled = next
    }
  }
}

export interface CozyPillButton {
  container: Phaser.GameObjects.Container
  setPosition(x: number, y: number): void
  setMode(index: number, total: number, label: string): void
}

/**
 * 顶部难度控件：保留“胶囊”但补上：
 * - 右侧 chevron（告诉用户它可切换）；
 * - 底部 3 个难度点（告诉用户当前是第几档）；
 * - 左侧叶片作为品牌装饰，但不再出现无语义“花生”。
 */
export function createCozyPillButton(
  scene: Phaser.Scene,
  initialIndex: number,
  total: number,
  label: string,
  action: () => void
): CozyPillButton {
  const WIDTH = 176
  const HEIGHT = 58

  const container = scene.add.container(0, 0).setDepth(350)
  const shadow = scene.add.graphics()
  const face = scene.add.graphics()
  const leaf = scene.add.graphics()
  const chevron = scene.add.graphics()
  const dots = scene.add.graphics()
  const text = scene.add.text(0, -6, label, {
    fontFamily: FONT,
    fontSize: '20px',
    color: '#fffdf6',
    fontStyle: 'bold'
  }).setOrigin(0.5)

  container.add([shadow, face, leaf, chevron, dots, text])

  let currentIndex = initialIndex
  let currentTotal = total

  const paint = (pressed = false): void => {
    const push = pressed ? 4 : 0

    shadow.clear()
    shadow.fillStyle(COZY.forestDark, 0.30)
    shadow.fillRoundedRect(-WIDTH / 2, -HEIGHT / 2 + 7, WIDTH, HEIGHT, 28)

    face.clear()
    face.fillStyle(pressed ? COZY.forestDark : COZY.forest, 0.985)
    face.fillRoundedRect(-WIDTH / 2, -HEIGHT / 2 + push, WIDTH, HEIGHT, 28)
    face.lineStyle(2.2, COZY.honey, 0.75)
    face.strokeRoundedRect(-WIDTH / 2 + 1, -HEIGHT / 2 + push + 1, WIDTH - 2, HEIGHT - 2, 27)
    face.lineStyle(1.4, 0xffffff, 0.14)
    face.strokeRoundedRect(-WIDTH / 2 + 4, -HEIGHT / 2 + push + 4, WIDTH - 8, HEIGHT - 8, 24)

    leaf.clear()
    leaf.fillStyle(COZY.honey, 1)
    leaf.fillEllipse(-62, -6 + push, 22, 12)
    leaf.rotation = -0.46

    chevron.clear()
    chevron.lineStyle(3.2, 0xfff8df, 0.90)
    chevron.beginPath()
    chevron.moveTo(60, -12 + push)
    chevron.lineTo(67, -6 + push)
    chevron.lineTo(60, 0 + push)
    chevron.strokePath()

    dots.clear()
    const gap = 12
    const startX = -gap * (currentTotal - 1) / 2
    for (let index = 0; index < currentTotal; index++) {
      dots.fillStyle(index === currentIndex ? COZY.honey : 0xffffff, index === currentIndex ? 1 : 0.34)
      dots.fillCircle(startX + index * gap, 16 + push, index === currentIndex ? 3.7 : 3.1)
    }

    text.y = -7 + push
  }

  paint()

  container.setSize(WIDTH, HEIGHT)
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, WIDTH, HEIGHT),
    Phaser.Geom.Rectangle.Contains
  )

  container.on('pointerdown', () => {
    paint(true)
    container.setScale(0.98)
  })

  container.on('pointerup', () => {
    paint(false)
    scene.tweens.add({ targets: container, scale: 1, duration: 115, ease: 'Back.Out' })
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
    setMode(index: number, nextTotal: number, nextLabel: string) {
      currentIndex = index
      currentTotal = nextTotal
      text.setText(nextLabel)
      paint(false)
    }
  }
}
