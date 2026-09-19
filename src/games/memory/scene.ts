import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PRODUCT_V3, preloadMemoryV3 } from '../../platform/display/product-v3-art'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordBest } from '../puzzle-kit/progress'
import { MemoryCardView } from './card-view'
import { conceal, flip, newGame } from './core/game'
import { memoryLayout } from './layout'
import { memoryVisualDelta } from './view-model'

export class MemoryScene extends PuzzleScene {
  protected override useResponsivePlayArea = true

  private pairs = 12
  private players = 1
  private setB = false
  private state = newGame(12)
  private concealTimer?: Phaser.Time.TimerEvent
  private cardViews: MemoryCardView[] = []

  constructor(audio: GameAudio, exit: () => void) {
    super('memory', '记忆翻牌', audio, exit)
  }

  preload(): void {
    preloadMemoryV3(this)
  }

  protected start(): void {
    this.buildView()
  }

  protected override onPlayAreaResize(): void {
    this.buildView()
  }

  private restart(): void {
    this.concealTimer?.remove()
    this.concealTimer = undefined
    this.state = newGame(this.pairs, this.players)
    this.buildView()
  }

  private buildView(): void {
    const area = this.playArea({ bottom: 84, horizontalPadding: 40 })
    const layout = memoryLayout(area, this.pairs, this.state.cards.length)
    const texture = this.setB ? PRODUCT_V3.memory.setB : PRODUCT_V3.memory.setA

    this.resetView(this.statusLine())
    this.cardViews = []

    ;[12, 16, 24].forEach((pairs, index) => {
      this.button(
        160 + index * 224,
        layout.modeY,
        `${pairs === this.pairs ? '✓ ' : ''}${pairs} 对`,
        () => {
          this.pairs = pairs
          this.restart()
        },
        190,
        this.content
      )
    })

    this.state.cards.forEach((value, index) => {
      const x = 384 +
        ((index % layout.cols) - (layout.cols - 1) / 2) *
        layout.step
      const y = layout.centerY +
        (Math.floor(index / layout.cols) - (layout.rows - 1) / 2) *
        layout.step

      const view = new MemoryCardView(
        this,
        x,
        y,
        layout.cell,
        texture,
        value % 24,
        () => this.handleFlip(index)
      )

      this.content.add(view.container)
      view.sync(
        this.state.open.includes(index) || this.state.matched.includes(index),
        this.state.matched.includes(index)
      )
      this.cardViews[index] = view
    })

    this.button(
      160,
      layout.footerY,
      this.players === 1 ? '单人 → 双人' : '双人 → 单人',
      () => {
        this.players = this.players === 1 ? 2 : 1
        this.restart()
      },
      200,
      this.content
    )

    this.button(
      384,
      layout.footerY,
      this.setB ? '换第一组' : '换第二组',
      () => {
        this.setB = !this.setB
        this.restart()
      },
      180,
      this.content
    )

    this.button(
      608,
      layout.footerY,
      '再玩一局',
      () => this.restart(),
      180,
      this.content
    )
  }

  private handleFlip(index: number): void {
    const previous = this.state
    const next = flip(previous, index)
    if (next === previous) return

    const delta = memoryVisualDelta(previous, next)
    this.state = next
    this.audio.playPlace(1)
    this.say(this.statusLine())

    for (const cardIndex of delta.reveal) {
      this.cardViews[cardIndex]?.sync(
        true,
        next.matched.includes(cardIndex),
        'flip'
      )
    }

    for (const cardIndex of delta.matched) {
      if (delta.reveal.includes(cardIndex)) continue
      this.cardViews[cardIndex]?.sync(true, true, 'match')
    }

    if (delta.matched.length > 0) this.audio.playPop(1.25)

    if (next.won) {
      this.finishWin()
      return
    }

    if (next.open.length === 2) {
      this.concealTimer?.remove()
      this.concealTimer = this.time.delayedCall(850, () => {
        this.concealTimer = undefined
        const beforeConceal = this.state
        const concealed = conceal(beforeConceal)
        if (concealed === beforeConceal) return

        const concealDelta = memoryVisualDelta(beforeConceal, concealed)
        this.state = concealed
        this.say(this.statusLine())

        for (const cardIndex of concealDelta.conceal) {
          this.cardViews[cardIndex]?.sync(false, false, 'flip')
        }
      })
    }
  }

  private finishWin(): void {
    const state = this.state
    this.celebrate(
      this.players === 2
        ? `完成！比分 ${state.scores.join(' : ')}`
        : `完成！用了 ${state.turns} 次`
    )
    recordBest(
      `memory-${this.pairs}:${this.players === 1 ? 'single' : 'duo'}`,
      state.turns
    )
  }

  private statusLine(): string {
    const state = this.state
    return `${state.turns} 次尝试 · ${
      this.players === 2
        ? `轮到玩家 ${state.player + 1}　比分 ${state.scores.join(' : ')}`
        : `找到 ${state.matched.length / 2} / ${this.pairs} 对`
    }`
  }
}
