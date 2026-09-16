import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordFlag } from '../puzzle-kit/progress'
import { clues, mark, newGame, PATTERNS, patternSize, solution, type Mark, type NonogramState } from './core/game'
export class NonogramScene extends PuzzleScene {
  private state = newGame()
  private mode: Mark = 1
  private history: NonogramState[] = []
  constructor(audio: GameAudio, exit: () => void) { super('nonogram', '数织', audio, exit) }
  protected start(): void { this.draw() }
  private draw(): void {
    const level = this.state.level, size = patternSize(level), target = solution(level)
    const cell = size === 5 ? 84 : 52
    const boardLeft = size === 5 ? 225 : 200, boardTop = size === 5 ? 310 : 230
    this.resetView(`第 ${level + 1} / ${PATTERNS.length} 幅 · 数字表示连续填色格数`)
    this.text(384, size === 5 ? 157 : 137, size === 5 ? '例如 2 1：填两格，至少空一格，再填一格' : '10×10 挑战 · 先从数字多的行列下手', 18, this.content)
    for (let i = 0; i < size; i++) {
      this.text(boardLeft - (size === 5 ? 63 : 55), boardTop + i * cell + cell / 2, clues(target.slice(i * size, i * size + size)).join(' '), size === 5 ? 25 : 16, this.content)
      this.text(boardLeft + i * cell + cell / 2, boardTop - (size === 5 ? 70 : 38), clues(Array.from({ length: size }, (_, y) => target[y * size + i]!)).join('\n'), size === 5 ? 24 : 15, this.content)
    }
    this.state.marks.forEach((value, index) => {
      const x = boardLeft + index % size * cell + cell / 2, y = boardTop + Math.floor(index / size) * cell + cell / 2
      const tile = this.add.rectangle(x, y, cell - 4, cell - 4, value === 1 ? (this.state.won ? 0xe88065 : 0x58a897) : 0xfffdf6).setStrokeStyle(2, 0xd8cdbb)
      this.content.add(tile)
      if (value === -1) this.text(x, y, '×', cell * 0.7, this.content)
      tile.setInteractive(new Phaser.Geom.Rectangle(-2, -2, cell, cell), Phaser.Geom.Rectangle.Contains).on('pointerup', () => this.change(index, value === this.mode ? 0 : this.mode))
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
    if (this.state.won) this.say(`画出来啦：${PATTERNS[level]!.name}！`)
  }
  private change(index: number, value: Mark): void {
    const next = mark(this.state, index, value)
    if (next === this.state) return
    this.history.push(this.state); this.state = next; this.audio.playMove(); this.draw()
    if (next.won) { this.audio.playWin(); recordFlag(`nonogram-${this.state.level}`) }
  }
}
