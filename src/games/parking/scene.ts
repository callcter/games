import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordFlag } from '../puzzle-kit/progress'
import { AxisDragController, type DragStop } from '../../experience/input/axis-drag'
import { pickup as pickupMotion, release as releaseMotion, snap as snapMotion } from '../../experience/feedback/motion'
import { createBurstPool } from '../../experience/feedback/particles'
import { EXIT_ROW, heroExit, legalTargets, MODES, newGame, slide, solve, type ParkState } from './core/game'
import { restoreParking } from '../puzzle-kit/core/drafts'

const CELL = 92, LEFT = 110, TOP = 235
const CAR_COLORS = [0xd94f43, 0x7e8dcd, 0xe6b84d, 0x58a897, 0xc47faf, 0x87b65e, 0x58b4d1, 0xe88065, 0xa3a3c2, 0x8f7ecf, 0xb98b63]

// 停车场手感参数集中在此，Playtest 后只调这里（EXPERIENCE-2 §59）。
const PARKING_FEEL = {
  rubberBand: 8,
  snapMs: 160,
  exitPauseMs: 80,
  exitMs: 440
} as const

const cellCenter = (x: number, y: number): [number, number] => [LEFT + x * CELL + CELL / 2, TOP + y * CELL + CELL / 2]

export class ParkingScene extends PuzzleScene {
  private mode = 0
  private state = newGame(0)
  private history: ParkState[] = []
  private selected = -1
  private moving = false
  private draggingId = -1
  /** 有拖动进行时挂起重绘请求，待会话结束再执行，避免吸附回调销毁新会话。 */
  private redrawPending = false
  private carViews = new Map<number, Phaser.GameObjects.Container>()
  private drags: AxisDragController[] = []
  private spots: Phaser.GameObjects.Rectangle[] = []
  private exitArrow: Phaser.GameObjects.Text | null = null
  private bursts = createBurstPool(this)

  constructor(audio: GameAudio, exit: () => void) { super('parking', '停车场', audio, exit) }

  protected start(): void {
    void this.offerResume('parking', restoreParking, saved => {
      this.mode = saved.mode; this.state = saved.state; this.history = saved.history; this.draw()
    }, saved => {
      this.mode = saved?.mode ?? this.mode
      this.restart()
    })
  }

  private restart(): void {
    if (this.draggingId >= 0) return
    this.selected = -1
    this.say('正在出题…')
    // 生成器最坏要重试上百次，推迟一帧让提示先画出来。
    this.time.delayedCall(30, () => {
      this.state = newGame(this.mode)
      this.history = []
      this.draw()
    })
  }

  private draw(keepSelection = false): void {
    if (!keepSelection) this.selected = -1
    this.moving = false
    this.carViews.clear()
    for (const drag of this.drags) drag.destroy()
    this.drags = []
    this.spots = [] // spot 随 resetView 一并销毁，这里只清引用。
    const par = solve(this.state, 8000)
    this.resetView(`把红车开出右边的出口 · ${this.state.moves} 步${par > 0 ? ` · 最少 ${par} 步` : ''}`)
    MODES.forEach((entry, index) => this.button(160 + 224 * index, 165, `${this.mode === index ? '✓ ' : ''}${entry.label}`, () => {
      if (index === this.mode || this.draggingId >= 0) return
      this.mode = index; this.restart()
    }, 190, this.content))

    const board = this.add.graphics()
    this.content.add(board)
    board.fillStyle(0xefe7d5, 1)
    board.fillRoundedRect(LEFT - 10, TOP - 10, CELL * 6 + 20, CELL * 6 + 20, 16)
    board.lineStyle(2, 0xe3dac8)
    for (let index = 1; index < 6; index++) {
      board.lineBetween(LEFT + index * CELL, TOP, LEFT + index * CELL, TOP + CELL * 6)
      board.lineBetween(LEFT, TOP + index * CELL, LEFT + CELL * 6, TOP + index * CELL)
    }
    // 出口豁口与箭头
    board.fillStyle(0xf8f1df, 1)
    board.fillRect(LEFT + CELL * 6 - 2, TOP + EXIT_ROW * CELL + 4, 12, CELL - 8)
    const arrow = this.add.text(LEFT + CELL * 6 + 26, TOP + EXIT_ROW * CELL + CELL / 2, '→', { fontSize: '30px', color: '#2f8f6b', fontStyle: 'bold' }).setOrigin(0.5)
    this.content.add(arrow)
    this.exitArrow = arrow

    this.state.cars.forEach(car => this.car(car))
    this.button(160, 850, '撤销', () => {
      if (!this.history.length || this.draggingId >= 0) return
      this.state = this.history.pop()!
      this.draw()
    }, 180, this.content)
    this.button(384, 850, '怎么玩', () => this.say('按住车直接拖到想停的格子；只有红车能开出右边出口'), 180, this.content)
    this.button(608, 850, '换一局', () => this.restart(), 180, this.content)
  }

  private car(car: ParkState['cars'][number]): void {
    const horizontal = car.horizontal
    // 车身与格线、邻车间各留 20px 以上呼吸空隙，避免挤成一团。
    const width = horizontal ? car.len * CELL - 22 : CELL - 24
    const height = horizontal ? CELL - 24 : car.len * CELL - 22
    const [cx, cy] = cellCenter(car.x + (horizontal ? car.len / 2 - 0.5 : 0), car.y + (horizontal ? 0 : car.len / 2 - 0.5))
    const group = this.add.container(cx, cy)
    this.content.add(group)
    this.carViews.set(car.id, group)
    const selected = this.selected === car.id
    const body = this.add.graphics()
    const color = car.id === 0 ? 0xd94f43 : CAR_COLORS[car.id % CAR_COLORS.length]!
    body.fillStyle(color, 1)
    body.fillRoundedRect(-width / 2, -height / 2, width, height, 14)
    body.lineStyle(3, selected ? 0xf8f1df : 0x36594b, selected ? 1 : 0.35)
    body.strokeRoundedRect(-width / 2, -height / 2, width, height, 14)
    // 挡风玻璃与车灯，让孩子一眼看出车头方向（车头朝行驶方向：横车朝右，竖车朝下；主车朝出口）。
    body.fillStyle(0xfff8e8, 0.9)
    if (horizontal) body.fillRoundedRect(width / 2 - width * 0.32, -height / 2 + 6, width * 0.24, height - 12, 6)
    else body.fillRoundedRect(-width / 2 + 6, height / 2 - height * 0.32, width - 12, height * 0.24, 6)
    body.fillStyle(0xfff3c4, 1)
    if (horizontal) { body.fillCircle(width / 2 - 5, -height / 2 + 5, 3); body.fillCircle(width / 2 - 5, height / 2 - 5, 3) }
    else { body.fillCircle(-width / 2 + 5, height / 2 - 5, 3); body.fillCircle(width / 2 - 5, height / 2 - 5, 3) }
    group.add(body)
    if (car.id === 0) {
      const star = this.add.text(0, 0, '★', { fontSize: '24px', color: '#fffdf6', fontStyle: 'bold' }).setOrigin(0.5)
      group.add(star)
    }
    // 车体即拖拽目标：按住直接拖（Experience 2.0 主操作）。
    group.setInteractive(new Phaser.Geom.Rectangle(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10), Phaser.Geom.Rectangle.Contains)
    this.attachDrag(car, group, horizontal)

    if (selected) {
      for (const target of legalTargets(this.state, car.id)) {
        const isExit = car.id === 0 && target === heroExit(this.state.cars)
        const gx = horizontal ? target + (car.len - 1) / 2 : car.x
        const gy = horizontal ? car.y : target + (car.len - 1) / 2
        const [tx, ty] = cellCenter(gx, gy)
        const spot = this.add.rectangle(tx, ty, CELL - 16, CELL - 16, isExit ? 0xf2b8b2 : 0xbfe3cf, 0.9)
        this.content.add(spot)
        this.spots.push(spot)
        spot.setInteractive({ useHandCursor: true })
        // 辅助路径：点目标格移动（默认主操作是拖车）。
        spot.on('pointerdown', () => this.move(car.id, target))
      }
    }
  }

  /** 给一辆车挂上轴向拖动：松手吸附最近合法格后才提交 core。 */
  private attachDrag(car: ParkState['cars'][number], view: Phaser.GameObjects.Container, horizontal: boolean): void {
    const stopsOf = (): DragStop[] => legalTargets(this.state, car.id).map(logical => ({
      logical,
      pixel: (horizontal ? LEFT : TOP) + (logical + car.len / 2) * CELL
    }))
    const drag = new AxisDragController(this, view, {
      axis: horizontal ? 'x' : 'y',
      getStops: stopsOf,
      isEnabled: () => !this.moving && !this.state.won && this.draggingId < 0,
      onPickup: () => {
        this.draggingId = car.id
        this.clearSpots()
        this.selected = -1
        this.content.bringToTop(view)
        this.tweens.killTweensOf(view)
        pickupMotion(this, view)
        this.audio.playMove()
      },
      onBlocked: () => { this.audio.playPlace(1) },
      onCommit: stop => { this.commitDrag(car.id, stop); this.flushRedraw() },
      onCancel: () => {
        this.draggingId = -1
        releaseMotion(this, view)
        // 原地轻点：退回旧点选路径，亮出目标格帮助孩子理解规则。
        this.select(car.id)
        this.flushRedraw()
      },
      rubberBand: PARKING_FEEL.rubberBand
    })
    this.drags.push(drag)
  }

  /** 拖动进行中挂起重绘；无会话时立即重绘。 */
  private requestRedraw(): void {
    if (!this.alive) return
    if (this.draggingId >= 0) { this.redrawPending = true; return }
    this.draw()
  }

  /** 拖动会话结束后消费挂起的重绘。 */
  private flushRedraw(): void {
    if (!this.redrawPending) return
    this.redrawPending = false
    this.requestRedraw()
  }

  private clearSpots(): void {
    for (const spot of this.spots) spot.destroy()
    this.spots = []
  }

  private select(id: number): void {
    if (this.moving || this.state.won) return
    this.selected = this.selected === id ? -1 : id
    this.audio.playMove()
    this.draw(true)
  }

  private move(id: number, target: number): void {
    if (this.moving || this.state.won) return
    const result = slide(this.state, id, target)
    if (!result) return
    this.moving = true
    this.history.push(this.state)
    if (this.history.length > 50) this.history.shift()
    this.state = result
    this.audio.playPlace(1)
    if (result.won) {
      this.celebrateExit()
      return
    }
    this.draw()
    this.moving = false
    const view = this.carViews.get(id)
    if (view) {
      view.setScale(1.08)
      this.tweens.add({ targets: view, scale: 1, duration: 180, ease: 'Back.Out' })
    }
    this.remember('parking', { state: this.state, history: this.history, mode: this.mode })
  }

  /** 拖动松手：吸附动画只动 view，完成后再整盘重绘。 */
  private commitDrag(id: number, stop: DragStop): void {
    this.draggingId = -1
    const result = slide(this.state, id, stop.logical)
    if (!result) { this.draw(); return } // 拖动期间状态被撤销等改变，防御性回绘。
    this.history.push(this.state)
    if (this.history.length > 50) this.history.shift()
    this.state = result
    this.audio.playPlace(1)
    if (result.won) {
      this.celebrateExit()
      return
    }
    this.remember('parking', { state: this.state, history: this.history, mode: this.mode })
    const view = this.carViews.get(id)
    const car = this.state.cars.find(entry => entry.id === id)!
    const [tx, ty] = cellCenter(car.x + (car.horizontal ? car.len / 2 - 0.5 : 0), car.y + (car.horizontal ? 0 : car.len / 2 - 0.5))
    if (view) {
      snapMotion(this, view, tx, ty, {
        duration: PARKING_FEEL.snapMs, settle: false,
        // 吸附动画完成时孩子可能已开始拖另一辆车：此时不能整盘重绘
        // （会销毁新会话的 view/controller 并留下无法解除的输入锁）。
        onComplete: () => this.requestRedraw()
      })
    } else {
      this.draw()
    }
  }

  /** 红车到出口：短暂停顿后加速驶出，沿途粒子尾迹、出口箭头亮起，棋盘保留为背景。 */
  private celebrateExit(): void {
    this.draw()
    const hero = this.state.cars[0]!
    const view = this.carViews.get(0)
    if (!view) return
    const [ex] = cellCenter(6 + hero.len / 2, hero.y)
    this.moving = true
    // 出口箭头亮起并放大，指向「路通了」。
    if (this.exitArrow) {
      this.exitArrow.setColor('#1f7a4d')
      this.exitArrow.setScale(1)
      this.tweens.add({ targets: this.exitArrow, scale: 1.5, duration: 340, yoyo: true, ease: 'Sine.InOut' })
    }
    this.time.delayedCall(PARKING_FEEL.exitPauseMs, () => {
      if (!this.alive) return
      this.tweens.add({
        targets: view, x: ex, duration: PARKING_FEEL.exitMs, ease: 'Cubic.In',
        onUpdate: () => {
          // 尾迹粒子从车尾散出，量小不遮棋盘。
          this.bursts.burst({ x: view.x - 60, y: view.y + (Phaser.Math.Between(-8, 8)), count: 3, speed: 90, lifespanMs: 420, tint: 0xfff3c4, radius: 4, gravityY: -30 })
        },
        onComplete: () => {
          recordFlag('parking-clear')
          this.remember('parking', null)
          this.showResultCard()
        }
      })
    })
  }

  /** 胜利结果卡：棋盘保留在背景，卡片从底部弹出；「再来一局」是第一主操作。 */
  private showResultCard(): void {
    this.audio.playWin()
    this.say(`红车开出去啦！用了 ${this.state.moves} 步`)
    const dim = this.add.rectangle(384, 450, 768, 900, 0x173f35, 0.28).setInteractive()
    this.content.add(dim)
    const card = this.add.container(384, 900)
    this.content.add(card)
    const panel = this.add.graphics()
    panel.fillStyle(0xfffdf6, 1)
    panel.fillRoundedRect(-260, -150, 520, 300, 22)
    panel.lineStyle(3, 0xd8cdbb, 1)
    panel.strokeRoundedRect(-260, -150, 520, 300, 22)
    card.add(panel)
    const title = this.add.text(0, -96, '红车开出去啦！', { fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '34px', color: '#173f35', fontStyle: 'bold' }).setOrigin(0.5)
    card.add(title)
    title.setScale(0.7)
    this.tweens.add({ targets: title, scale: 1, duration: 280, ease: 'Back.Out' })
    const detail = this.add.text(0, -34, `用了 ${this.state.moves} 步 · ${MODES[this.mode]!.label}难度`, { fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '22px', color: '#4c5b53' }).setOrigin(0.5)
    card.add(detail)
    const replay = this.button(0, 28, '再来一局', () => { this.restart() }, 300, card)
    replay.setFontSize(24)
    const leave = this.button(0, 108, '回游戏屋', () => { this.exit() }, 220, card)
    leave.setFontSize(19)
    card.y = 1050
    this.tweens.add({ targets: card, y: 640, duration: 320, ease: 'Back.Out' })
  }
}
