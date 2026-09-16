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
  // 切开的两个半果沿切线法线分开下坠，配上按水果颜色染色的果汁。
  private playCut(fruit: Fruit, from: TrailPoint, to: TrailPoint): void {
    const index = this.views.findIndex(view => Math.abs(view.x - fruit.x) < 1 && Math.abs(view.y - fruit.y) < 1)
    if (index >= 0) { this.views.splice(index, 1)[0]?.destroy(); this.spins.splice(index, 1) }
    const emoji = fruit.bomb ? '💣' : FRUITS[fruit.kind]!
    const angle = Math.atan2(to.y - from.y, to.x - from.x) + Math.PI / 2
    for (const side of [-1, 1]) {
      const half = this.add.text(fruit.x + Math.cos(angle) * 16 * side, fruit.y + Math.sin(angle) * 16 * side, emoji, { fontSize: '64px' }).setOrigin(0.5)
      this.entities.add(half)
      this.tweens.add({
        targets: half,
        x: half.x + Math.cos(angle) * 90 * side + (side * 40),
        y: half.y + 300,
        rotation: side * 1.5,
        alpha: 0,
        duration: 620,
        ease: 'Cubic.In',
        onComplete: () => half.destroy()
      })
    }
    if (!fruit.bomb) this.spray(`juice-${fruit.kind}`, fruit.x, fruit.y, 12, 230)
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
