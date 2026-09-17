import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { ActionScene, FIELD } from '../action-kit/scene'
import { hitTest, MODES, newGame, pop, step, type Bubble } from './core/game'

type BubbleView = Phaser.GameObjects.Container & { orb: Phaser.GameObjects.Arc; glint: Phaser.GameObjects.Arc; shine: Phaser.GameObjects.Graphics }

export class PopBubblesScene extends ActionScene {
  private state = newGame()
  private views: BubbleView[] = []
  constructor(audio: GameAudio, exit: () => void) { super('pop-bubbles', '点泡泡', audio, exit) }
  protected modes(): readonly { label: string }[] {
    return MODES.map((entry, index) => ({ label: `${this.mode === index ? '✓ ' : ''}${entry.label}` }))
  }
  protected headline(): string { return '点破上升的泡泡，泡泡越小分越高，金色三倍' }
  protected roundSeconds(_mode: number): number { return 60 }
  /** 时间到保留游戏世界为背景（Wave 3）。 */
  protected override showResult(score: number, isBest: boolean, best: number): void {
    this.showKeptResult(score, isBest, best, '#58a897')
  }

  protected replay(): void { this.launch(this.mode, this.roundSeconds(this.mode)) }
  protected roundScore(): number { return this.state.score }
  protected statusLine(): string {
    return `分数 ${this.state.score} · 已点破 ${this.state.popped} 个 · 剩余 ${this.remainingSeconds} 秒`
  }
  protected startRound(mode: number): void {
    this.state = newGame(mode)
    this.views = []
    this.makeDotTexture('pop-drop', 0x7ec8e3, 5)
    this.makeDotTexture('pop-gold', 0xe6b84d, 5)
    this.onRoundInput('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.running) return
      const index = hitTest(this.state, pointer.x, pointer.y)
      if (index < 0) return
      const bubble = this.state.bubbles[index]!
      const before = this.state.score
      this.state = pop(this.state, index)
      this.views.splice(index, 1)[0]?.destroy()
      this.audio.playPop(2 - bubble.radius / 34)
      this.spray(bubble.golden ? 'pop-gold' : 'pop-drop', bubble.x, bubble.y, bubble.golden ? 14 : 9, 190)
      this.floatScore(bubble.x, bubble.y, this.state.score - before)
    })
  }
  protected tick(delta: number): void {
    this.state = step(this.state, delta)
    if (this.views.length !== this.state.bubbles.length) {
      this.views.forEach(view => view.destroy())
      this.views = this.state.bubbles.map(bubble => this.makeBubble(bubble))
      return
    }
    this.state.bubbles.forEach((bubble, index) => this.syncBubble(this.views[index]!, bubble))
  }
  private makeBubble(bubble: Bubble): BubbleView {
    const body = this.add.circle(0, 0, bubble.radius, bubble.golden ? 0xe6b84d : 0x7ec8e3, 0.72)
      .setStrokeStyle(4, bubble.golden ? 0xd9a12e : 0xffffff, 0.9)
    const glint = this.add.circle(0, 0, Math.max(3, bubble.radius * 0.22), 0xffffff, 0.85)
    const shine = this.add.graphics()
    const view = this.add.container(bubble.x, bubble.y, [body, shine, glint]) as BubbleView
    view.orb = body
    view.glint = glint
    view.shine = shine
    this.entities.add(view)
    this.syncBubble(view, bubble)
    return view
  }
  private syncBubble(view: BubbleView, bubble: Bubble): void {
    view.setPosition(bubble.x, bubble.y)
    view.orb.setRadius(bubble.radius)
      .setFillStyle(bubble.golden ? 0xe6b84d : 0x7ec8e3, 0.35)
      .setStrokeStyle(3, bubble.golden ? 0xd9a12e : 0x58a9c8, 0.85)
    view.glint.setPosition(-bubble.radius * 0.35, -bubble.radius * 0.35).setRadius(Math.max(3, bubble.radius * 0.22))
    const r = bubble.radius
    view.shine.clear().lineStyle(3, 0xffffff, 0.9)
      .beginPath().arc(0, 0, r * 0.8, Math.PI * 1.1, Math.PI * 1.55).strokePath()
      .lineStyle(2, bubble.golden ? 0xfff1a4 : 0xcaa8e8, 0.8)
      .beginPath().arc(0, 0, r * 0.84, 0.1, 1.25).strokePath()
    if (bubble.golden) {
      view.shine.lineStyle(2, 0xfffaf0, 1)
        .lineBetween(-r * 0.2, 0, r * 0.2, 0).lineBetween(0, -r * 0.2, 0, r * 0.2)
    }
  }
  private floatScore(x: number, y: number, gained: number): void {
    const label = this.text(x, Math.max(FIELD.top + 20, y - 20), `+${gained}`, 24, this.entities).setColor(gained >= 3 ? '#d9a12e' : '#2f6f8f')
    this.tweens.add({ targets: label, y: label.y - 46, alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => label.destroy() })
  }
}
