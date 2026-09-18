import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordFlag } from '../puzzle-kit/progress'
import { canPour, MODES, newGame, pour, topRun, TUBE_CAPACITY, type WaterState } from './core/game'
import { restoreWaterSort } from '../puzzle-kit/core/drafts'
import { preloadWaterArt, WATER_BG_KEY, WATER_GLOSS_KEY, WATER_TUBE_KEY } from './art'
import { releaseHostBackdrop, setHostBackdrop } from '../../platform/display/host-backdrop'

// 颜色与符号双重标识，色弱也能分辨；顺序与颜色索引一致。
const PALETTE = [0xe88065, 0x58a897, 0xe6b84d, 0x7e8dcd, 0xc47faf, 0x3689b0]
const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚']

const TUBE_W = 66, TUBE_H = 204, LAYER_H = 46

// 液体渲染的颜色微调：亮/暗因子 ∈ (-1, 1)，模拟液面反光与层底阴影。
const shade = (color: number, factor: number): number => {
  const channel = (value: number): number => Math.max(0, Math.min(255, Math.round(factor >= 0 ? value + (255 - value) * factor : value * (1 + factor))))
  return (channel((color >> 16) & 255) << 16) | (channel((color >> 8) & 255) << 8) | channel(color & 255)
}
// 素材管区严格纵横比（132×407），显示宽度按高度等比推导，避免横向拉伸。
const TUBE_ART_RATIO = 132 / 407
const tubeArtWidth = (height: number): number => Math.round(height * TUBE_ART_RATIO)

export class WaterSortScene extends PuzzleScene {
  /** 试管容器视图，倒水反馈动画用；draw 时重建。 */
  private readonly tubeBodies = new Map<number, Phaser.GameObjects.Container>()
  private mode = 0
  private state = newGame(0)
  private history: WaterState[] = []
  private selected = -1

  constructor(audio: GameAudio, exit: () => void) { super('water-sort', '水排序', audio, exit) }

  preload(): void {
    preloadWaterArt(this)
  }

  create(): void {
    // 木桌台面铺整张画布垫底（续玩弹窗/棋盘全局生效）；素材缺失保持米色底。
    if (this.textures.exists(WATER_BG_KEY)) {
      this.add.image(384, 450, WATER_BG_KEY).setDisplaySize(768, 900).setDepth(-10)
      // 画布外 letterbox 区域用同一张背景 cover 铺满（画布内不变形）。
      setHostBackdrop('art/water-bg.png')
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, releaseHostBackdrop)
      this.events.once(Phaser.Scenes.Events.DESTROY, releaseHostBackdrop)
    }
    super.create()
  }

  protected start(): void {
    void this.offerResume('water-sort', restoreWaterSort, saved => {
      this.mode = saved.mode; this.state = saved.state; this.history = saved.history; this.draw()
    }, saved => {
      this.mode = saved?.mode ?? this.mode
      this.restart()
    })
  }

  private restart(): void {
    this.state = newGame(this.mode)
    this.history = []
    this.selected = -1
    this.draw()
  }

  private draw(): void {
    this.tubeBodies.clear()
    const done = this.state.tubes.filter(tube => tube.length === TUBE_CAPACITY && topRun(tube) === TUBE_CAPACITY).length
    this.resetView(`把每根试管倒成同一种颜色 · ${this.state.moves} 步 · 完成 ${done}/${this.state.colors}`)
    MODES.forEach((entry, index) => this.button(160 + 224 * index, 165, `${this.mode === index ? '✓ ' : ''}${entry.label}`, () => {
      if (index === this.mode) return
      this.mode = index; this.restart()
    }, 190, this.content))

    const total = this.state.tubes.length
    const topRow = Math.ceil(total / 2), bottomRow = total - topRow
    this.state.tubes.forEach((tube, index) => {
      const row = index < topRow ? 0 : 1
      const inRow = row === 0 ? index : index - topRow
      const columns = row === 0 ? topRow : bottomRow
      const x = 384 + (inRow - (columns - 1) / 2) * 128
      const y = row === 0 ? 330 : 608
      this.tube(tube, x, y, index)
    })

    this.button(160, 850, '撤销', () => {
      if (!this.history.length) return
      this.state = this.history.pop()!
      this.draw()
    }, 180, this.content)
    this.button(384, 850, '提示规则', () => this.say('点一根管子，再点另一根倒过去；只能倒进空管或同色顶'), 180, this.content)
    this.button(608, 850, '换一局', () => this.restart(), 180, this.content)
  }

  /** 画一根试管：玻璃管身 + 自底向上水层 + 色符号；完成管顶部打勾。 */
  private tube(tube: number[], x: number, y: number, index: number): void {
    const selected = this.selected === index
    const body = this.add.container(x, y)
    this.content.add(body)
    this.tubeBodies.set(index, body)
    if (selected) {
      // 拿起：弹起并轻轻倾斜，像真的捏起一根试管。
      this.tweens.add({ targets: body, y: y - 12, angle: -6, duration: 170, ease: 'Back.Out' })
    }
    const finished = tube.length === TUBE_CAPACITY && topRun(tube) === TUBE_CAPACITY
    // 素材可用时：管身底图垫在水层下、高光覆盖叠在水层上；否则退回程序化玻璃。
    const useArt = this.textures.exists(WATER_TUBE_KEY)
    if (useArt) body.add(this.add.image(0, 0, WATER_TUBE_KEY).setDisplaySize(tubeArtWidth(TUBE_H + 2), TUBE_H + 2))
    const glass = this.add.graphics()
    if (!useArt) {
      glass.fillStyle(0xfffdf6, 0.6)
      glass.fillRoundedRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W, TUBE_H, { tl: 10, tr: 10, bl: 26, br: 26 })
      glass.lineStyle(3, 0x527267, 0.8)
      glass.strokeRoundedRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W, TUBE_H, { tl: 10, tr: 10, bl: 26, br: 26 })
      glass.fillStyle(0xffffff, 0.35)
      glass.fillRoundedRect(-TUBE_W / 2 + 7, -TUBE_H / 2 + 12, 8, TUBE_H - 60, 4)
    }
    if (selected) {
      glass.lineStyle(4, 0xe88065, 1)
      glass.strokeRoundedRect(-TUBE_W / 2 - 4, -TUBE_H / 2 - 4, TUBE_W + 8, TUBE_H + 8, { tl: 12, tr: 12, bl: 28, br: 28 })
    }
    body.add(glass)
    // 液体渲染（2026-09-18 重做）：连续液柱 + 每层顶部反光带 + 层底暗带，
    // 顶面画弯月面椭圆——去掉旧版「每层独立圆角块 + 1px 间隙」的格子感。
    tube.forEach((color, layer) => {
      const top = -TUBE_H / 2 + 10 + (TUBE_CAPACITY - 1 - layer) * LAYER_H
      const base = PALETTE[color] ?? 0x999999
      const bottomLayer = layer === 0
      const water = this.add.graphics()
      water.fillStyle(base, 1)
      // +2 让层与层无缝衔接；最底层沿用试管底部圆角。
      water.fillRoundedRect(-TUBE_W / 2 + 5, top, TUBE_W - 10, LAYER_H + 2, bottomLayer ? { tl: 0, tr: 0, bl: 18, br: 18 } : { tl: 0, tr: 0, bl: 0, br: 0 })
      // 层顶反光带（液体上表面反光）
      water.fillStyle(shade(base, 0.35), 0.55)
      water.fillRect(-TUBE_W / 2 + 5, top + 2, TUBE_W - 10, 4)
      // 层底暗带（厚度感）
      water.fillStyle(shade(base, -0.25), 0.5)
      water.fillRect(-TUBE_W / 2 + 5, top + LAYER_H - 5, TUBE_W - 10, 5)
      body.add(water)
      const symbol = this.add.text(0, top + LAYER_H / 2, SYMBOLS[color] ?? '?', { fontSize: '22px', color: '#fffdf6', fontStyle: 'bold' }).setOrigin(0.5)
      body.add(symbol)
    })
    // 顶层液面：弯月面椭圆 + 中央高光，让「这是液体」一眼可读。
    if (tube.length) {
      const topColor = tube[tube.length - 1]!
      const surfaceY = -TUBE_H / 2 + 10 + (TUBE_CAPACITY - tube.length) * LAYER_H
      const surface = this.add.graphics()
      surface.fillStyle(shade(PALETTE[topColor] ?? 0x999999, 0.25), 1)
      surface.fillEllipse(0, surfaceY + 3, TUBE_W - 12, 11)
      surface.fillStyle(0xffffff, 0.5)
      surface.fillEllipse(-3, surfaceY + 2, TUBE_W - 26, 5)
      body.add(surface)
    }
    if (finished) {
      const badge = this.add.text(0, -TUBE_H / 2 - 18, '✓', { fontSize: '26px', color: '#2f8f6b', fontStyle: 'bold' }).setOrigin(0.5)
      body.add(badge)
    }
    if (this.textures.exists(WATER_GLOSS_KEY)) {
      // 高光覆盖在最高层（水层、符号之上），两条竖高光与管口沿自带半透明。
      body.add(this.add.image(0, 0, WATER_GLOSS_KEY).setDisplaySize(tubeArtWidth(TUBE_H + 2), TUBE_H + 2))
    }
    // 触控区域比管身大一圈，孩子的手指好点。
    // 先入容器再开交互：加入容器后输入矩阵才会随容器注册；alpha 极小但非 0，
    // Phaser 4 会把完全透明的对象从输入命中里剔除。
    const hit = this.add.rectangle(x, y, TUBE_W + 34, TUBE_H + 30, 0xffffff, 0.001)
    this.content.add(hit)
    hit.setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => this.tap(index))
  }

  private tap(index: number): void {
    if (this.state.won) return
    if (this.selected < 0) {
      if (this.state.tubes[index]?.length) {
        this.selected = index
        this.audio.playMove()
        this.draw()
      }
      return
    }
    if (this.selected === index) {
      this.selected = -1
      this.draw()
      return
    }
    const fromIndex = this.selected
    const result = pour(this.state, this.selected, index)
    if (!result) {
      this.audio.playPop(1)
      this.say(canPour(this.state, fromIndex, index) ? '' : '只能倒进空管或颜色相同的管子哦')
      this.selected = -1
      this.draw()
      // 非法倒水：源管左右摆两下「倒不进去」。
      const from = this.tubeBodies.get(fromIndex)
      if (from) this.tweens.add({ targets: from, angle: { from: -5, to: 5 }, duration: 80, yoyo: true, repeat: 2, onComplete: () => from.setAngle(0) })
      return
    }
    this.history.push(this.state)
    if (this.history.length > 50) this.history.shift()
    this.state = result.state
    this.selected = -1
    this.audio.playPop(1 + result.poured)
    this.draw()
    // 倒进去了：目标管轻微一沉再弹回，像真的接住了水。
    const target = this.tubeBodies.get(index)
    if (target) {
      target.setScale(1, 0.965)
      this.tweens.add({ targets: target, scaleY: 1, duration: 220, ease: 'Back.Out' })
    }
    this.remember('water-sort', { state: this.state, history: this.history, mode: this.mode })
    if (this.state.won) {
      recordFlag('water-sort-clear')
      this.celebrate('全部倒好啦！')
    }
  }

}
