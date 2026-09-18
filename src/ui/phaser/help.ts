// 共享玩法说明面板：任何 Phaser.Scene 可直接调用（768 宽逻辑坐标，居中布局）。
// 首次进入的游戏自动弹一次（localStorage 记录），之后从顶栏"?"按钮打开。
import Phaser from 'phaser'
import { getGameHelp, type GameHelp } from '../help-content'

const SEEN_KEY = 'family-game-room-help-seen-v1'
const PANEL_W = 620
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
  const width = scene.scale.width
  const height = scene.scale.height

  const layer = scene.add.container(0, 0).setDepth(9999)
  // Rectangle 形状原点在中心：hitArea 必须以 [-w/2,-h/2] 为左上角，否则左上半屏点不到遮罩。
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x10261f, 0.55)
    .setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains)
  layer.add(shade)

  const stepsH = help.steps.length * 56
  const tipH = help.tip ? 46 : 0
  const panelH = 132 + 66 + stepsH + tipH + 96
  const top = (height - panelH) / 2
  const card = scene.add.graphics()
  card.fillStyle(0xfffdf6, 0.98)
  card.fillRoundedRect((width - PANEL_W) / 2, top, PANEL_W, panelH, 28)
  card.lineStyle(2, 0x2f7865, 0.35)
  card.strokeRoundedRect((width - PANEL_W) / 2, top, PANEL_W, panelH, 28)
  layer.add(card)

  const centerX = width / 2
  const icon = scene.add.text(centerX, top + 64, help.icon, { fontFamily: FONT, fontSize: '52px' }).setOrigin(0.5)
  const name = scene.add.text(centerX, top + 128, `${help.title} · 怎么玩`, {
    fontFamily: FONT, fontSize: '30px', color: '#173f35', fontStyle: 'bold'
  }).setOrigin(0.5)
  const goal = scene.add.text(centerX, top + 172, help.goal, {
    fontFamily: FONT, fontSize: '21px', color: '#2f7865', fontStyle: 'bold', align: 'center', wordWrap: { width: PANEL_W - 72 }
  }).setOrigin(0.5, 0)
  layer.add([icon, name, goal])

  help.steps.forEach((step, index) => {
    const y = top + 232 + index * 56
    const bullet = scene.add.text(centerX - 246, y, `${index + 1}.`, {
      fontFamily: FONT, fontSize: '20px', color: '#e8963f', fontStyle: 'bold'
    }).setOrigin(0.5)
    const line = scene.add.text(centerX - 216, y, step, {
      fontFamily: FONT, fontSize: '20px', color: '#173f35', wordWrap: { width: PANEL_W - 128 }, align: 'left'
    }).setOrigin(0, 0.5)
    layer.add([bullet, line])
  })

  if (help.tip) {
    const tip = scene.add.text(centerX, top + 232 + help.steps.length * 56 + 18, `小提示：${help.tip}`, {
      fontFamily: FONT, fontSize: '17px', color: '#527267', align: 'center', wordWrap: { width: PANEL_W - 96 }
    }).setOrigin(0.5)
    layer.add(tip)
  }

  let closed = false
  // 打开过就算"看过"（哪怕没点关闭就继续玩），避免重复打扰
  markHelpSeen(title)
  const close = (): void => {
    if (closed) return
    closed = true
    layer.destroy(true)
    onClose?.()
  }

  const buttonW = 240
  const button = scene.add.container(centerX, top + panelH - 52)
  const face = scene.add.graphics()
  face.fillStyle(0x2f7865)
  face.fillRoundedRect(-buttonW / 2, -28, buttonW, 56, 16)
  const label = scene.add.text(0, 0, '知道啦，开始玩', {
    fontFamily: FONT, fontSize: '22px', color: '#fffdf6', fontStyle: 'bold'
  }).setOrigin(0.5)
  button.add([face, label])
  button.setSize(buttonW, 56)
  // hitArea 必须用 [0, size] 本地坐标（Phaser 4 Container displayOrigin 语义）
  button.setInteractive(new Phaser.Geom.Rectangle(0, 0, buttonW, 56), Phaser.Geom.Rectangle.Contains)
    .on('pointerdown', () => button.setScale(0.96))
    .on('pointerup', close)
  layer.add(button)
  shade.on('pointerdown', close)

  layer.setScale(0.9)
  scene.tweens.add({ targets: layer, scale: 1, duration: 160, ease: 'Back.Out' })

  // 场景离开时兜底销毁，防止面板跨游戏残留
  const cleanup = (): void => {
    if (!closed) { closed = true; layer.destroy(true) }
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
