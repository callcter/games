import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { ActionScene, FIELD } from '../action-kit/scene'
import { ensureFruitArtFrames, fruitArtKey, preloadFruitSheets } from '../../platform/display/fruit-sprites'
import { endSwipe, FRUIT_RADIUS, FRUITS, MODES, newGame, slice, step, type Fruit } from './core/game'
import { makeCutHalf } from './cut-art'

const TRAIL_MS = 130
const JUICE_COLORS = [0xe8564d, 0xf05a61, 0xf39a48, 0xd85e54, 0xef9c8e, 0xd8a93d]

interface TrailPoint { x: number; y: number; t: number }

// 六种飞行水果与共享素材等级的对应（西瓜/草莓/凸顶柑/苹果/桃子/菠萝）。
const KIND_TO_LEVEL = [10, 1, 3, 5, 7, 8] as const

export class FruitSlicerScene extends ActionScene {
  private state = newGame()
  private views: (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] = []
  private useArtFruits = false
  private spins: number[] = []
  private trail: TrailPoint[] = []
  private blade!: Phaser.GameObjects.Graphics
  private lastPointer: TrailPoint | null = null
  private lastWhoosh = 0
  private pendingMode = 0
  private hudScore: Phaser.GameObjects.Text | null = null
  private hudScoreLabel: Phaser.GameObjects.Text | null = null
  private hudTime: Phaser.GameObjects.Text | null = null
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

  /** 自定义 intro（EXPERIENCE-2 §8.1）：玩具柜式主按钮 + 次级难度行 + 手势教学动画。 */
  protected override showIntro(): void {
    this.running = false
    this.pendingMode = this.mode
    const best = Math.max(...[0, 1, 2].map(mode => {
      try {
        const value = Number(window.localStorage.getItem(`family-game-room-fruit-slicer-v2-best-${mode}`))
        return Number.isFinite(value) && value >= 0 ? value : 0
      } catch { return 0 }
    }))
    this.resetView('准备好了吗？')
    // 中央三颗装饰水果轻微浮动，让画面像玩具柜而不是设置页。
    if (ensureFruitArtFrames(this)) {
      this.useArtFruits = true
      ;[10, 5, 3].forEach((level, index) => {
        const fruit = this.add.image(384 + (index - 1) * 150, 330 + (index === 1 ? -26 : 0), fruitArtKey(level))
        const size = level === 10 ? 132 : 104
        fruit.setDisplaySize(size, size)
        this.content.add(fruit)
        this.tweens.add({ targets: fruit, y: fruit.y - 10, duration: 1400 + index * 240, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
      })
    }
    const start = this.button(384, 508, '开 始', () => this.launch(this.pendingMode, this.roundSeconds(this.pendingMode)), 264, this.content)
    start.setFontSize(26)
    const modeRow = this.text(384, 592, `难度：${MODES[this.pendingMode]!.label} ›`, 21, this.content)
    modeRow.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.pendingMode = (this.pendingMode + 1) % MODES.length
      modeRow.setText(`难度：${MODES[this.pendingMode]!.label} ›`)
      this.audio.playPlace(1)
    })
    if (best > 0) this.text(384, 650, `最高纪录 ${best} 分`, 20, this.content).setColor('#698379')
    // 手势教学：淡虚线 + 往返的滑动光点，不挡主按钮，任何真实输入都无冲突。
    const coachLine = this.add.graphics()
    coachLine.lineStyle(4, 0x9c7047, 0.28)
    coachLine.lineBetween(214, 760, 554, 700)
    this.content.add(coachLine)
    const dot = this.add.circle(214, 760, 13, 0xffb84d, 0.85)
    this.content.add(dot)
    this.tweens.add({
      targets: dot, x: 554, y: 700, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      onYoyo: () => dot.setAlpha(0.25), onRepeat: () => dot.setAlpha(0.85)
    })
    this.text(384, 806, '像这样滑动切开水果', 17, this.content).setColor('#8a7c66')
  }

  /** 回合开始的轻提示：不阻塞输入，500ms 内缩放淡出。 */
  protected override launch(mode: number, seconds: number): void {
    super.launch(mode, seconds)
    const go = this.text(384, 520, '开始！', 46, this.entities)
    go.setScale(0.6)
    this.tweens.add({ targets: go, scale: 1.15, alpha: 0, duration: 560, ease: 'Back.Out', onComplete: () => go.destroy() })
  }

  /** HUD 拆成视觉块（EXPERIENCE-2 §8.3）：大数字分数 + 右上时间，不用长句状态行。 */
  protected override showHud(): void {
    if (!this.hudScore || !this.hudTime) {
      this.hudScore = this.text(120, 148, `${this.state.score}`, 40, this.content)
      this.hudScoreLabel = this.text(120, 186, '分数', 15, this.content)
      this.hudScoreLabel.setColor('#8a7c66')
      this.hudTime = this.text(648, 148, `${Math.ceil(this.remainingSeconds)}s`, 30, this.content)
    }
    const score = this.hudScore
    const time = this.hudTime
    score.setText(`${this.state.score}`)
    time.setText(`${Math.ceil(this.remainingSeconds)}s`)
    time.setColor(this.remainingSeconds <= 10 ? '#cb6544' : '#173f35')
  }

  /** 保留最后一帧的结算（EXPERIENCE-2 §8.4）：水果世界只压暗不清空，卡片底部弹出。 */
  protected override showResult(score: number, isBest: boolean, best: number): void {
    this.hudScore = null
    this.hudScoreLabel = null
    this.hudTime = null
    this.say(isBest ? `新纪录 ${score} 分！` : `时间到！本局 ${score} 分`)
    const dim = this.add.rectangle(384, 450, 768, 900, 0x173f35, 0.36).setInteractive()
    this.content.add(dim)
    const card = this.add.container(384, 0)
    this.content.add(card)
    const panel = this.add.graphics()
    panel.fillStyle(0xfffdf6, 0.98)
    panel.fillRoundedRect(-235, -165, 470, 330, 24)
    panel.lineStyle(3, 0xd8cdbb, 1)
    panel.strokeRoundedRect(-235, -165, 470, 330, 24)
    card.add(panel)
    const banner = this.add.text(0, -112, isBest ? '✦ 新纪录 ✦' : '✦ 时间到 ✦', {
      color: isBest ? '#cb6544' : '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '36px', fontStyle: 'bold'
    }).setOrigin(0.5)
    card.add(banner)
    banner.setScale(0.7)
    this.tweens.add({ targets: banner, scale: 1, duration: 260, ease: 'Back.Out' })
    card.add(this.add.text(0, -46, `本局 ${score} 分 · 最高 ${Math.max(score, best)} 分`, {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '22px'
    }).setOrigin(0.5))
    const replay = this.add.text(0, 30, '再来一次', {
      color: '#fffaf0', backgroundColor: '#cb6544',
      fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '23px', fontStyle: 'bold',
      padding: { x: 30, y: 13 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.replay())
    card.add(replay)
    const change = this.add.text(0, 118, '换个难度', {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '18px'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.showIntro())
    card.add(change)
    card.y = 1150
    this.tweens.add({ targets: card, y: 560, duration: 340, ease: 'Back.Out' })
  }

  preload(): void {
    preloadFruitSheets(this)
  }

  protected startRound(mode: number): void {
    this.useArtFruits = ensureFruitArtFrames(this)
    this.state = newGame(mode)
    this.views = []
    this.spins = []
    this.trail = []
    this.lastPointer = null
    this.lastWhoosh = 0
    this.drawBoard()
    JUICE_COLORS.forEach((color, index) => this.makeDotTexture(`juice-${index}`, color, 5))
    this.makeDotTexture('sparkle-white', 0xffffff, 4)
    this.makeDotTexture('sparkle-gold', 0xffe08a, 5)
    this.blade = this.add.graphics()
    this.entities.add(this.blade)
    this.onRoundInput('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.running || pointer.y < FIELD.top || pointer.y > 890) return
      this.state = endSwipe(this.state)
      this.lastPointer = { x: pointer.x, y: pointer.y, t: performance.now() }
      this.trail = [this.lastPointer]
    })
    this.onRoundInput('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.running || !pointer.isDown || !this.lastPointer) return
      if (pointer.y < FIELD.top || pointer.y > 900 || pointer.x < 0 || pointer.x > 768) { this.finishSwipe(); return }
      const previous = this.lastPointer
      const current = { x: pointer.x, y: pointer.y, t: performance.now() }
      if (Math.hypot(current.x - previous.x, current.y - previous.y) < 3) return
      this.trySlice(previous, current)
      if (current.t - this.lastWhoosh > 160 && Math.hypot(current.x - previous.x, current.y - previous.y) > 18) {
        this.audio.playWhoosh(); this.lastWhoosh = current.t
      }
      if (!this.trail.length) this.trail.push({ ...previous, t: current.t - 16 })
      this.trail.push(current)
      if (this.trail.length > 48) this.trail.shift()
      this.lastPointer = current
    })
    this.onRoundInput('pointerup', () => this.finishSwipe())
    this.onRoundInput('pointerupoutside', () => this.finishSwipe())
    this.onRoundInput('gameout', () => this.finishSwipe())
  }
  private finishSwipe(): void { this.lastPointer = null; this.state = endSwipe(this.state) }

  private drawBoard(): void {
    const board = this.add.graphics()
    board.fillStyle(0x553e32).fillRoundedRect(12, 220, 744, 672, 22)
    for (let row = 0; row < 7; row++) {
      const y = 232 + row * 92
      board.fillStyle(row % 2 ? 0x644a3a : 0x6c503d).fillRoundedRect(22, y, 724, 86, 8)
      board.lineStyle(1, 0xc39766, 0.14)
      for (let line = 0; line < 3; line++) board.lineBetween(42 + row * 7, y + 17 + line * 21, 720 - row * 9, y + 14 + line * 21)
    }
    this.entities.add(board)
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
      this.audio.playPop(0.9 + Math.min(4, this.state.swipeCount) * 0.12)
      const gained = result.cutFruits.length + result.bonus
      this.floatText(to.x, to.y - 20, result.bonus ? `${this.state.swipeCount} 连切！+${gained}` : `+${gained}`, result.bonus ? '#ffe08a' : '#fff4d3', result.bonus ? 30 : 24)
    }
  }
  // 固化切中瞬间的朝向，两个透明半果继承抛出速度并沿切线法向分离。
  private playCut(fruit: Fruit, from: TrailPoint, to: TrailPoint): void {
    const index = this.views.findIndex(view => Math.abs(view.x - fruit.x) < 1 && Math.abs(view.y - fruit.y) < 1)
    const rotation = index >= 0 ? this.views[index]!.rotation : 0
    if (index >= 0) { this.views.splice(index, 1)[0]?.destroy(); this.spins.splice(index, 1) }
    if (fruit.bomb) return
    const tx = Math.cos(Math.atan2(to.y - from.y, to.x - from.x))
    const ty = Math.sin(Math.atan2(to.y - from.y, to.x - from.x))
    const nx = -ty, ny = tx
    for (const side of [-1, 1] as const) {
      const half = makeCutHalf(this, this.useArtFruits ? fruitArtKey(KIND_TO_LEVEL[fruit.kind]!) : null,
        FRUITS[fruit.kind]!, fruit.kind, rotation, Math.atan2(ty, tx), side).setPosition(fruit.x, fruit.y)
      this.entities.add(half)
      const vx = fruit.vx * 0.6 + nx * 180 * side
      const vy = fruit.vy * 0.3 + ny * 180 * side - 100
      this.tweens.add({
        targets: half, rotation: side * 1.4, duration: 720,
        onUpdate: tween => {
          const t = tween.progress * 0.72
          half.setPosition(fruit.x + vx * t, fruit.y + vy * t + 650 * t * t)
          half.setAlpha(Math.min(1, (1 - tween.progress) * 3))
        },
        onComplete: () => half.destroy()
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
    this.splash(fruit)
  }
  private splash(fruit: Fruit): void {
    const mark = this.add.graphics().setPosition(fruit.x, fruit.y)
    mark.fillStyle(JUICE_COLORS[fruit.kind]!, 0.35).fillEllipse(0, 0, 64, 45)
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4 + fruit.kind
      mark.fillCircle(Math.cos(a) * (25 + i * 4), Math.sin(a) * (20 + i * 3), 3 + i % 4)
    }
    this.entities.addAt(mark, 1)
    this.tweens.add({ targets: mark, alpha: 0, delay: 250, duration: 800, onComplete: () => mark.destroy() })
  }
  protected tick(delta: number): void {
    this.state = step(this.state, delta)
    if (this.views.length !== this.state.fruits.length) {
      this.views.forEach(view => view.destroy())
      this.spins = this.state.fruits.map((fruit, index) => (index % 2 ? 1 : -1) * (0.8 + (fruit.kind % 3) * 0.5))
      this.views = this.state.fruits.map(fruit => {
        const view = this.useArtFruits
          ? this.add.image(fruit.x, fruit.y, fruitArtKey(fruit.bomb ? -1 : KIND_TO_LEVEL[fruit.kind]!)).setDisplaySize(FRUIT_RADIUS * 2, FRUIT_RADIUS * 2)
          : this.add.text(fruit.x, fruit.y, fruit.bomb ? '💣' : FRUITS[fruit.kind]!, { fontSize: '68px' })
        view.setOrigin(0.5)
        this.entities.add(view)
        return view
      })
    }
    this.state.fruits.forEach((fruit, index) => {
      const view = this.views[index]!
      view.setPosition(fruit.x, fruit.y)
      // 一颗离场、另一颗同帧出生时数量不变，仍要同步外观，不能把炸弹画成果实。
      if (view instanceof Phaser.GameObjects.Image) {
        const key = fruitArtKey(fruit.bomb ? -1 : KIND_TO_LEVEL[fruit.kind]!)
        if (view.texture.key !== key) view.setTexture(key).setDisplaySize(FRUIT_RADIUS * 2, FRUIT_RADIUS * 2)
      } else view.setText(fruit.bomb ? '💣' : FRUITS[fruit.kind]!)
      view.rotation += this.spins[index]! * delta / 1000
    })
    this.drawBlade()
  }
  // 刀光：保留近 130ms 的轨迹，越新越粗越实。
  private drawBlade(): void {
    const now = performance.now()
    this.trail = this.trail.filter(point => now - point.t <= TRAIL_MS)
    this.blade.clear()
    this.entities.bringToTop(this.blade)
    for (let i = 1; i < this.trail.length; i++) {
      const age = (now - this.trail[i]!.t) / TRAIL_MS
      const from = this.trail[i - 1]!, to = this.trail[i]!
      const width = Math.max(1, 8 * (1 - age))
      this.blade.lineStyle(width * 2.4, 0x8be3ff, 0.18 * (1 - age))
        .lineBetween(from.x, from.y, to.x, to.y)
      this.blade.lineStyle(width, 0xffffff, 0.95 * (1 - age))
        .lineBetween(from.x, from.y, to.x, to.y)
      this.blade.fillStyle(0xffffff, 0.9 * (1 - age)).fillCircle(to.x, to.y, width / 2)
    }
  }
  private floatText(x: number, y: number, content: string, color: string, size: number): void {
    const label = this.text(Phaser.Math.Clamp(x, 120, 648), Math.max(280, y), content, size, this.entities).setColor(color)
    this.tweens.add({ targets: label, y: label.y - 46, alpha: 0, duration: 560, ease: 'Cubic.Out', onComplete: () => label.destroy() })
  }
}
