import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { clues, mark, newGame, PATTERNS, solution, type Mark, type NonogramState } from './core/game'
export class NonogramScene extends PuzzleScene {
  private state = newGame()
  private mode: Mark = 1
  private history: NonogramState[] = []
  constructor(audio: GameAudio, exit: () => void) { super('nonogram', '数织', audio, exit) }
  protected start(): void { this.draw() }
  private draw(): void {
    this.resetView(`第 ${this.state.level + 1} / ${PATTERNS.length} 关 · 数字表示连续填色格数`)
    this.text(384, 157, '例如 2 1：填两格，至少空一格，再填一格', 18, this.content)
    const target = solution(this.state.level), size = 84, left = 225, top = 310
    for (let i = 0; i < 5; i++) {
      this.text(162, top + i * size + size / 2, clues(target.slice(i * 5, i * 5 + 5)).join('  '), 25, this.content)
      this.text(left + i * size + size / 2, 240, clues(Array.from({ length: 5 }, (_, y) => target[y * 5 + i]!)).join('\n'), 24, this.content)
    }
    this.state.marks.forEach((value, index) => {
      const x = left + index % 5 * size + size / 2, y = top + Math.floor(index / 5) * size + size / 2
      const tile = this.add.rectangle(x, y, size - 4, size - 4, value === 1 ? (this.state.won ? 0xe88065 : 0x58a897) : 0xfffdf6).setStrokeStyle(2, 0xd8cdbb)
      this.content.add(tile)
      if (value === -1) this.text(x, y, '×', 35, this.content)
      tile.setInteractive().on('pointerup', () => this.change(index, value === this.mode ? 0 : this.mode))
    })
    this.button(180, 780, this.mode === 1 ? '✓ 填色' : '填色', () => { this.mode = 1; this.draw() }, 150, this.content)
    this.button(370, 780, this.mode === -1 ? '✓ 标空' : '标空', () => { this.mode = -1; this.draw() }, 150, this.content)
    this.button(570, 780, '提示一格', () => {
      const i = target.findIndex((v, i) => v === 1 ? this.state.marks[i] !== 1 : this.state.marks[i] === 1)
      if (i >= 0) this.change(i, target[i] ? 1 : -1)
    }, 180, this.content)
    this.button(160, 850, '撤销', () => { this.state = this.history.pop() ?? this.state; this.draw() }, 180, this.content)
    this.button(384, 850, '重开', () => { this.state = newGame(this.state.level); this.history = []; this.draw() }, 180, this.content)
    this.button(608, 850, '下一幅', () => { this.state = newGame((this.state.level + 1) % PATTERNS.length); this.history = []; this.draw() }, 180, this.content)
    if (this.state.won) this.say(`画出来啦：${PATTERNS[this.state.level]!.name}！`)
  }
  private change(index: number, value: Mark): void {
    const next = mark(this.state, index, value)
    if (next === this.state) return
    this.history.push(this.state); this.state = next; this.audio.playMove(); this.draw()
    if (next.won) this.audio.playWin()
  }
}
