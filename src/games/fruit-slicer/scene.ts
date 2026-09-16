import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { ActionScene } from '../action-kit/scene'
import { FRUITS, MODES, newGame, slice, step, type Fruit } from './core/game'

const TRAIL_MS = 130
const JUICE_COLORS = [0xe88065, 0xc0392b, 0xe6952d, 0x87b65e, 0xe6b84d, 0x7e8dcd]

interface TrailPoint { x: number; y: number; t: number }

export class FruitSlicerScene extends ActionScene {
  private state = newGame()
  private views: Phaser.GameObjects.Text[] = []
  private spins: number[] = []
  private trail: TrailPoint[] = []
  private blade!: Phaser.GameObjects.Graphics
  constructor(audio: GameAudio, exit: () => void) { super('fruit-slicer', '切水果', audio, exit) }
  protected modes(): readonly { label: string }[] {
    return MODES.map((entry, index) => ({ label: `${this.mode === index ? '✓ ' : ''}${entry.label}` }))
  }
  protected headline(): string { return '滑动手势切开抛起的水果，一刀多果有奖励；黑色炸弹会扣时间' }
  protected roundSeconds(_mode: number): number { return 60 }
  protected replay(): void { this.launch(this.mode, this.roundSeconds(this.mode)) }
  protected roundScore(): number { return this.state.score }
  protected statusLine(): string {
    return `分数 ${this.state.score} · 已切 ${this.state.cut} 个 · 剩余 ${this.remainingSeconds} 秒`
  }
  protected startRound(mode: number): void {
    this.state = newGame(mode)
    this.views = []
    this.spins = []
    this.trail = []
    JUICE_COLORS.forEach((color, index) => this.makeDotTexture(`juice-${index}`, color, 5))
    this.makeDotTexture('sparkle-white', 0xffffff, 4)
    this.makeDotTexture('sparkle-gold', 0xffe08a, 5)
    this.blade = this.add.graphics()
    this.entities.add(this.blade)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.running) return
      this.trail = [{ x: pointer.x, y: pointer.y, t: performance.now() }]
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.running || !pointer.isDown || !this.trail.length) return
      const previous = this.trail.at(-1)!
      const current = { x: pointer.x, y: pointer.y, t: performance.now() }
      if (Math.hypot(current.x - previous.x, current.y - previous.y) < 3) return
      this.trySlice(previous, current)
      this.trail.push(current)
    })
  }
  private trySlice(from: TrailPoint, to: TrailPoint): void {
    const result = slice(this.state, from.x, from.y, to.x, to.y)
    if (!result.cutFruits.length) return
    this.state = result.state
    for (const fruit of result.cutFruits) this.playCut(fruit, from, to)
    if (result.bombs) {
      this.addTime(-5000 * result.bombs)
      this.audio.playBurst()
      this.cameras.main.shake(150, 0.004)
      this.floatText(to.x, to.y - 30, `炸弹 −${result.bombs * 5} 秒`, '#c0392b', 22)
    } else {
      this.audio.playWhoosh()
      const gained = result.cutFruits.length + result.bonus
      this.floatText(to.x, to.y - 20, result.bonus ? `+${gained} 一刀多果！` : `+${gained}`, result.bonus ? '#d9a12e' : '#2f6f8f', result.bonus ? 26 : 24)
    }
  }
  // 切开的水果沿切线裂成两半：emoji 套固定半平面遮罩，半果从切口滑出下坠，
  // 切口有闪光线加白金双色闪亮粒子和对应颜色的果汁。
  private playCut(fruit: Fruit, from: TrailPoint, to: TrailPoint): void {
    const index = this.views.findIndex(view => Math.abs(view.x - fruit.x) < 1 && Math.abs(view.y - fruit.y) < 1)
    if (index >= 0) { this.views.splice(index, 1)[0]?.destroy(); this.spins.splice(index, 1) }
    if (fruit.bomb) return
    const emoji = FRUITS[fruit.kind]!
    const tx = Math.cos(Math.atan2(to.y - from.y, to.x - from.x))
    const ty = Math.sin(Math.atan2(to.y - from.y, to.x - from.x))
    const nx = -ty, ny = tx
    for (const side of [-1, 1] as const) {
      const half = this.add.container(fruit.x, fruit.y)
      half.add(this.add.text(0, 0, emoji, { fontSize: '68px' }).setOrigin(0.5))
      this.entities.add(half)
      // 固定在世界坐标的半平面遮罩：只显示切线法向 side 一侧，半果移动时从切口滑出。
      const shape = this.make.graphics()
      const reach = 160
      shape.fillStyle(0xffffff)
      shape.fillPoints([
        new Phaser.Math.Vector2(fruit.x - tx * reach, fruit.y - ty * reach),
        new Phaser.Math.Vector2(fruit.x + tx * reach, fruit.y + ty * reach),
        new Phaser.Math.Vector2(fruit.x + tx * reach + nx * reach * side, fruit.y + ty * reach + ny * reach * side),
        new Phaser.Math.Vector2(fruit.x - tx * reach + nx * reach * side, fruit.y - ty * reach + ny * reach * side)
      ], true)
      half.setMask(shape.createGeometryMask())
      this.tweens.add({
        targets: half,
        x: fruit.x + nx * 120 * side,
        y: fruit.y + 330,
        rotation: side * 1.4,
        alpha: 0,
        duration: 640,
        ease: 'Cubic.In',
        onComplete: () => { half.destroy(); shape.destroy() }
      })
    }
    const flash = this.add.graphics()
    flash.lineStyle(6, 0xfff3c4, 0.95)
    flash.lineBetween(fruit.x - tx * 44, fruit.y - ty * 44, fruit.x + tx * 44, fruit.y + ty * 44)
    this.entities.add(flash)
    this.tweens.add({ targets: flash, alpha: 0, duration: 220, onComplete: () => flash.destroy() })
    this.spray('sparkle-white', fruit.x, fruit.y, 8, 340, 380)
    this.spray('sparkle-gold', fruit.x, fruit.y, 6, 260, 460)
    this.spray(`juice-${fruit.kind}`, fruit.x, fruit.y, 12, 230)
  }
  protected tick(delta: number): void {
    this.state = step(this.state, delta)
    if (this.views.length !== this.state.fruits.length) {
      this.views.forEach(view => view.destroy())
      this.spins = this.state.fruits.map((fruit, index) => (index % 2 ? 1 : -1) * (0.8 + (fruit.kind % 3) * 0.5))
      this.views = this.state.fruits.map(fruit => {
        const view = this.add.text(fruit.x, fruit.y, fruit.bomb ? '💣' : FRUITS[fruit.kind]!, { fontSize: '68px' }).setOrigin(0.5)
        this.entities.add(view)
        return view
      })
    }
    this.state.fruits.forEach((fruit, index) => {
      const view = this.views[index]!
      view.setPosition(fruit.x, fruit.y)
      view.rotation += this.spins[index]! * delta / 1000
    })
    this.drawBlade()
  }
  // 刀光：保留近 130ms 的轨迹，越新越粗越实。
  private drawBlade(): void {
    const now = performance.now()
    this.trail = this.trail.filter(point => now - point.t <= TRAIL_MS)
    this.blade.clear()
    for (let i = 1; i < this.trail.length; i++) {
      const age = (now - this.trail[i]!.t) / TRAIL_MS
      this.blade.lineStyle(Math.max(2, 10 * (1 - age)), 0xffffff, Math.max(0.25, 0.95 * (1 - age)))
      this.blade.lineBetween(this.trail[i - 1]!.x, this.trail[i - 1]!.y, this.trail[i]!.x, this.trail[i]!.y)
    }
  }
  private floatText(x: number, y: number, content: string, color: string, size: number): void {
    const label = this.text(x, Math.max(248, y), content, size, this.entities).setColor(color)
    this.tweens.add({ targets: label, y: label.y - 46, alpha: 0, duration: 560, ease: 'Cubic.Out', onComplete: () => label.destroy() })
  }
}
