import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordBest } from '../puzzle-kit/progress'
import { conceal, flip, newGame } from './core/game'

const FRUITS = ['🍎', '🍌', '🍇', '🍉', '🍊', '🍓', '🍒', '🥝', '🍑', '🥭', '🍍', '🥥', '🍐', '🍏', '🍈', '🥑', '🍋', '🍅', '🥕', '🌽', '🍄', '🌰', '🥜', '🍞']
const ANIMALS = ['🐱', '🐶', '🐰', '🐼', '🦊', '🐸', '🐻', '🐯', '🦁', '🐨', '🐷', '🐮', '🐔', '🐧', '🦆', '🦉', '🦋', '🐝', '🐞', '🐢', '🐬', '🦄', '🐙', '🐳']

export class MemoryScene extends PuzzleScene {
  private pairs = 12
  private players = 1
  private animals = false
  private state = newGame(12)
  private concealTimer?: Phaser.Time.TimerEvent
  constructor(audio: GameAudio, exit: () => void) { super('memory', '记忆翻牌', audio, exit) }
  protected start(): void { this.draw() }
  private restart(): void {
    this.concealTimer?.remove()
    this.state = newGame(this.pairs, this.players)
    this.draw()
  }
  private draw(animatedIndex = -1): void {
    const s = this.state
    this.resetView(`${s.turns} 次尝试 · ${this.players === 2 ? `轮到玩家 ${s.player + 1}　比分 ${s.scores.join(' : ')}` : `找到 ${s.matched.length / 2} / ${this.pairs} 对`}`)
    ;[12, 16, 24].forEach((pairs, i) => this.button(170 + i * 214, 165, `${pairs === this.pairs ? '✓ ' : ''}${pairs} 对`, () => { this.pairs = pairs; this.restart() }, 190, this.content))
    const cols = this.pairs === 12 ? 6 : 8
    const rows = s.cards.length / cols
    const cell = Math.min(148, 570 / cols, 450 / rows)
    s.cards.forEach((value, index) => {
      const x = 384 + ((index % cols) - (cols - 1) / 2) * (cell + 12)
      const y = 270 + Math.floor(index / cols) * (cell + 12)
      const shown = s.open.includes(index) || s.matched.includes(index)
      const tile = this.add.rectangle(x, y, cell, cell, s.matched.includes(index) ? 0xcce4d1 : shown ? 0xfffdf6 : 0x58a897).setStrokeStyle(3, 0xffffff)
      this.content.add(tile)
      const label = this.text(x, y, shown ? (this.animals ? ANIMALS : FRUITS)[value]! : '✦', cell * 0.46, this.content)
      if (index === animatedIndex) {
        if (s.matched.includes(index)) {
          // 新配对：两张牌欢快地弹一下。
          tile.setScale(1.18); label.setScale(1.18)
          this.tweens.add({ targets: [tile, label], scale: 1, duration: 240, ease: 'Back.Out' })
        } else {
          tile.setScale(0.65, 1); label.setScale(0.65, 1)
          this.tweens.add({ targets: [tile, label], scaleX: 1, duration: 140, ease: 'Cubic.Out' })
        }
      }
      tile.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        const next = flip(this.state, index)
        if (next === this.state) return
        const matchedBefore = this.state.matched.length
        this.state = next
        this.audio.playPlace(1)
        if (next.matched.length > matchedBefore) this.audio.playPop(1.25)
        this.draw(index)
        if (next.won) {
          this.celebrate(this.players === 2 ? `完成！比分 ${next.scores.join(' : ')}` : `完成！用了 ${next.turns} 次`)
          recordBest(`memory-${this.pairs}:${this.players === 1 ? 'single' : 'duo'}`, next.turns)
        }
        else if (next.open.length === 2) this.concealTimer = this.time.delayedCall(850, () => { this.state = conceal(this.state); this.draw() })
      })
    })
    this.button(160, 850, this.players === 1 ? '单人 → 双人' : '双人 → 单人', () => { this.players = this.players === 1 ? 2 : 1; this.restart() }, 200, this.content)
    this.button(384, 850, this.animals ? '换水果' : '换动物', () => { this.animals = !this.animals; this.restart() }, 180, this.content)
    this.button(610, 850, '再玩一局', () => this.restart(), 180, this.content)
  }
}
