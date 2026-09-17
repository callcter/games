import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordFlag } from '../puzzle-kit/progress'
import { EXIT_ROW, heroExit, legalTargets, MODES, newGame, slide, solve, type ParkState } from './core/game'
import { restoreParking } from '../puzzle-kit/core/drafts'

const CELL = 92, LEFT = 110, TOP = 235
const CAR_COLORS = [0xd94f43, 0x7e8dcd, 0xe6b84d, 0x58a897, 0xc47faf, 0x87b65e, 0x58b4d1, 0xe88065, 0xa3a3c2, 0x8f7ecf, 0xb98b63]

const cellCenter = (x: number, y: number): [number, number] => [LEFT + x * CELL + CELL / 2, TOP + y * CELL + CELL / 2]

export class ParkingScene extends PuzzleScene {
  private mode = 0
  private state = newGame(0)
  private history: ParkState[] = []
  private selected = -1
  private moving = false
  private carViews = new Map<number, Phaser.GameObjects.Container>()

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
    const par = solve(this.state, 8000)
    this.resetView(`把红车开出右边的出口 · ${this.state.moves} 步${par > 0 ? ` · 最少 ${par} 步` : ''}`)
    MODES.forEach((entry, index) => this.button(160 + 224 * index, 165, `${this.mode === index ? '✓ ' : ''}${entry.label}`, () => {
      if (index === this.mode) return
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

    this.state.cars.forEach(car => this.car(car))
    this.button(160, 850, '撤销', () => {
      if (!this.history.length) return
      this.state = this.history.pop()!
      this.draw()
    }, 180, this.content)
    this.button(384, 850, '怎么玩', () => this.say('点一辆车，再点亮起的空格；只有红车能开出出口'), 180, this.content)
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
    const hit = this.add.rectangle(cx, cy, width + 10, height + 10, 0xffffff, 0.001)
    this.content.add(hit)
    hit.setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => this.select(car.id))

    if (selected) {
      for (const target of legalTargets(this.state, car.id)) {
        const isExit = car.id === 0 && target === heroExit(this.state.cars)
        const gx = horizontal ? target + (car.len - 1) / 2 : car.x
        const gy = horizontal ? car.y : target + (car.len - 1) / 2
        const [tx, ty] = cellCenter(gx, gy)
        const spot = this.add.rectangle(tx, ty, CELL - 16, CELL - 16, isExit ? 0xf2b8b2 : 0xbfe3cf, 0.9)
        this.content.add(spot)
        spot.setInteractive({ useHandCursor: true })
        spot.on('pointerdown', () => this.move(car.id, target))
      }
    }
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
      this.draw()
      const car = this.state.cars[0]!
      const view = this.carViews.get(0)
      if (view) {
        const [ex] = cellCenter(6 + car.len / 2, car.y)
        this.tweens.add({ targets: view, x: ex, duration: 480, ease: 'Cubic.In', onComplete: () => {
          recordFlag('parking-clear')
          this.celebrate('红车开出去啦！')
          this.remember('parking', null)
        } })
      }
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
}
