import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordFlag } from '../puzzle-kit/progress'
import { canPour, MODES, newGame, pour, topRun, TUBE_CAPACITY, type WaterState } from './core/game'
import { restoreWaterSort } from '../puzzle-kit/core/drafts'

// 颜色与符号双重标识，色弱也能分辨；顺序与颜色索引一致。
const PALETTE = [0xe88065, 0x58a897, 0xe6b84d, 0x7e8dcd, 0xc47faf, 0x3689b0]
const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚']

const TUBE_W = 66, TUBE_H = 204, LAYER_H = 46

export class WaterSortScene extends PuzzleScene {
  /** 试管容器视图，倒水反馈动画用；draw 时重建。 */
  private readonly tubeBodies = new Map<number, Phaser.GameObjects.Container>()
  private mode = 0
  private state = newGame(0)
  private history: WaterState[] = []
  private selected = -1

  constructor(audio: GameAudio, exit: () => void) { super('water-sort', '水排序', audio, exit) }

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
    const glass = this.add.graphics()
    glass.fillStyle(0xfffdf6, 0.6)
    glass.fillRoundedRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W, TUBE_H, { tl: 10, tr: 10, bl: 26, br: 26 })
    glass.lineStyle(3, selected ? 0xe88065 : 0x527267, selected ? 1 : 0.8)
    glass.strokeRoundedRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W, TUBE_H, { tl: 10, tr: 10, bl: 26, br: 26 })
    glass.fillStyle(0xffffff, 0.35)
    glass.fillRoundedRect(-TUBE_W / 2 + 7, -TUBE_H / 2 + 12, 8, TUBE_H - 60, 4)
    body.add(glass)
    tube.forEach((color, layer) => {
      const top = -TUBE_H / 2 + 10 + (TUBE_CAPACITY - 1 - layer) * (LAYER_H + 1)
      const water = this.add.graphics()
      water.fillStyle(PALETTE[color] ?? 0x999999, 1)
      water.fillRoundedRect(-TUBE_W / 2 + 5, top, TUBE_W - 10, LAYER_H, { tl: 4, tr: 4, bl: 4, br: 4 })
      body.add(water)
      const symbol = this.add.text(0, top + LAYER_H / 2, SYMBOLS[color] ?? '?', { fontSize: '22px', color: '#fffdf6', fontStyle: 'bold' }).setOrigin(0.5)
      body.add(symbol)
    })
    if (finished) {
      const badge = this.add.text(0, -TUBE_H / 2 - 18, '✓', { fontSize: '26px', color: '#2f8f6b', fontStyle: 'bold' }).setOrigin(0.5)
      body.add(badge)
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
