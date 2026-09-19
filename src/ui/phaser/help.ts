// 共享玩法说明面板：任何 Phaser.Scene 可直接调用。
// 首次进入的游戏自动弹一次（localStorage 记录），之后从顶栏"?"按钮打开。
// 面板宽度自适应视口（窄屏收窄并按行数增高），场景 resize 时整体重建，
// 进场用短 fade 避免过冲抖动。
import Phaser from 'phaser'
import { getGameHelp, type GameHelp } from '../help-content'

const SEEN_KEY = 'family-game-room-help-seen-v1'
const MAX_PANEL_W = 620
const FONT = 'Avenir Next, PingFang SC, sans-serif'

function seenIds(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function markHelpSeen(title: string): void {
  try {
    const ids = new Set(seenIds())
    ids.add(title)
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
  } catch {
    // 存储不可用时静默，下次再弹一次没有关系
  }
}

/**
 * 弹出玩法说明面板。返回关闭函数（场景销毁时可主动收起）。
 * 面板吞掉全部指针事件，游戏不会被误触。
 */
export function showHelpPanel(scene: Phaser.Scene, title: string, onClose?: () => void): (() => void) | null {
  const help: GameHelp | null = getGameHelp(title)
  if (!help) return null

  let layer: Phaser.GameObjects.Container | null = null
  let closed = false
  // 打开过就算"看过"（哪怕没点关闭就继续玩），避免重复打扰
  markHelpSeen(title)

  const build = (): void => {
    if (closed) return
    layer?.destroy(true)
    const width = scene.scale.width
    const height = scene.scale.height
    const cardW = Math.min(width - 32, MAX_PANEL_W)
    const narrow = cardW < MAX_PANEL_W - 8

    layer = scene.add.container(0, 0).setDepth(9999)
    // Rectangle 形状原点在中心：hitArea 必须以 [-w/2,-h/2] 为左上角，否则左上半屏点不到遮罩。
    const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x10261f, 0.55)
      .setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains)
    layer.add(shade)
    shade.on('pointerdown', close)

    const centerX = width / 2
    const icon = scene.add.text(centerX, 0, help.icon, { fontFamily: FONT, fontSize: narrow ? '42px' : '52px' }).setOrigin(0.5)
    const name = scene.add.text(centerX, 0, `${help.title} · 怎么玩`, {
      fontFamily: FONT, fontSize: narrow ? '26px' : '30px', color: '#173f35', fontStyle: 'bold'
    }).setOrigin(0.5)
    const goal = scene.add.text(centerX, 0, help.goal, {
      fontFamily: FONT, fontSize: narrow ? '19px' : '21px', color: '#2f7865', fontStyle: 'bold',
      align: 'center', wordWrap: { width: cardW - 64 }
    }).setOrigin(0.5)
    const steps = help.steps.map((step, index) => ({ index, text: scene.add.text(centerX, 0, step, {
      fontFamily: FONT, fontSize: narrow ? '18px' : '20px', color: '#173f35',
      wordWrap: { width: cardW - (narrow ? 76 : 128) }, align: 'left'
    }).setOrigin(0, 0.5) }))
    const tip = help.tip
      ? scene.add.text(centerX, 0, `小提示：${help.tip}`, {
          fontFamily: FONT, fontSize: narrow ? '15px' : '17px', color: '#527267',
          align: 'center', wordWrap: { width: cardW - 72 }
        }).setOrigin(0.5)
      : null

    // 第一遍按常规排版；若窄屏换行导致超高，进入 dense 模式：
    // 去掉大图标行并压缩间距，保证"知道啦"按钮始终在屏内。
    let dense = false
    let stepGap = 56
    let measure = (): number => {
      let h = (dense ? 8 : 44 + 54) + 20 + goal.height + 22
      steps.forEach(step => { h += Math.max(stepGap, step.text.height + 12) })
      if (tip) h += tip.height + 12
      return h + 96
    }
    let panelH = measure()
    if (panelH > height - 24) {
      dense = true
      stepGap = 46
      panelH = measure()
      if (panelH > height - 24) {
        stepGap = 40
        panelH = measure()
      }
    }
    panelH = Math.min(panelH, height - 24)
    const top = Math.max(12, (height - panelH) / 2)

    const card = scene.add.graphics()
    card.fillStyle(0xfffdf6, 0.98)
    card.fillRoundedRect(centerX - cardW / 2, top, cardW, panelH, 24)
    card.lineStyle(2, 0x2f7865, 0.35)
    card.strokeRoundedRect(centerX - cardW / 2, top, cardW, panelH, 24)

    let y = dense ? top + 20 : top + 58
    if (!dense) {
      icon.setPosition(centerX, y + icon.height / 2 - 4)
      y += icon.height + 30
    }
    name.setPosition(centerX, y + name.height / 2)
    y += name.height + 12
    goal.setPosition(centerX, y + goal.height / 2)
    y += goal.height + 22
    for (const step of steps) {
      const lineH = Math.max(stepGap, step.text.height + 12)
      const bulletX = centerX - cardW / 2 + (narrow ? 18 : 34)
      const bullet = scene.add.text(bulletX, y + lineH / 2, `${step.index + 1}.`, {
        fontFamily: FONT, fontSize: narrow ? '18px' : '20px', color: '#e8963f', fontStyle: 'bold'
      }).setOrigin(0, 0.5)
      step.text.setPosition(bulletX + (narrow ? 24 : 30), y + lineH / 2)
      layer.add(bullet)
      layer.add(step.text)
      y += lineH
    }
    if (tip) {
      tip.setPosition(centerX, y + tip.height / 2 + 6)
      y += tip.height + 12
    }

    const buttonW = Math.min(240, cardW - 48)
    const button = scene.add.container(centerX, top + panelH - 52)
    const face = scene.add.graphics()
    face.fillStyle(0x2f7865)
    face.fillRoundedRect(-buttonW / 2, -28, buttonW, 56, 16)
    const label = scene.add.text(0, 0, '知道啦，开始玩', {
      fontFamily: FONT, fontSize: narrow ? '19px' : '22px', color: '#fffdf6', fontStyle: 'bold'
    }).setOrigin(0.5)
    button.add([face, label])
    button.setSize(buttonW, 56)
    // hitArea 必须用 [0, size] 本地坐标（Phaser 4 Container displayOrigin 语义）
    button.setInteractive(new Phaser.Geom.Rectangle(0, 0, buttonW, 56), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => button.setScale(0.96))
      .on('pointerup', close)

    layer.add([card, name, goal, ...(dense ? [] : [icon]), ...(tip ? [tip] : []), button])
    layer.setAlpha(0)
    scene.tweens.add({ targets: layer, alpha: 1, duration: 150, ease: 'Cubic.Out' })
  }

  const close = (): void => {
    if (closed) return
    closed = true
    layer?.destroy(true)
    layer = null
    onClose?.()
  }

  build()
  // 视口变化（旋转/手机地址栏收起）时按新尺寸重建，避免面板停在不存在的坐标上
  const onResize = (): void => { if (!closed) build() }
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize)

  // 场景离开时兜底销毁，防止面板跨游戏残留
  const cleanup = (): void => {
    if (!closed) { closed = true; layer?.destroy(true); layer = null }
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize)
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
  scene.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
  return close
}

/** 首次进入某游戏时自动弹一次说明；已看过或场景已离开则跳过。 */
export function attachFirstRunHelp(
  scene: Phaser.Scene,
  title: string,
  delayMs = 700,
  hooks: { onOpen?: () => void; onClose?: () => void } = {}
): void {
  if (!getGameHelp(title) || seenIds().includes(title)) return
  scene.time.delayedCall(delayMs, () => {
    if (!scene.scene || !scene.sys.isActive() || seenIds().includes(title)) return
    showHelpPanel(scene, title, hooks.onClose)
    hooks.onOpen?.()
  })
}
