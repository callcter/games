import type { GameAudio } from '../../platform/audio/game-audio'
import { INK, PuzzleScene } from '../puzzle-kit/scene'
import { recordFlag } from '../puzzle-kit/progress'
import { conflicts, newGame, place, SIZES, type SudokuState } from './core/game'
import { restoreSudoku } from '../puzzle-kit/core/drafts'

export class SudokuScene extends PuzzleScene {
  private size: SudokuState['size'] = 4
  private state = newGame(4)
  private selected = -1
  private history: SudokuState[] = []
  private assisted = false
  constructor(audio: GameAudio, exit: () => void) { super('sudoku', '数独', audio, exit) }
  protected start(): void {
    void this.offerResume('sudoku', restoreSudoku, saved => {
      this.state = saved.state; this.size = saved.state.size; this.history = saved.history; this.assisted = saved.assisted; this.draw()
    }, saved => { this.size = saved?.state.size ?? this.size; this.restart() })
  }
  private draw(): void {
    this.history = this.history.slice(-50)
    this.remember('sudoku', { state: this.state, history: this.history, assisted: this.assisted })
    const clash = conflicts(this.state.values, this.state.size)
    const size = this.state.size
    this.resetView(this.state.won ? '全部填对啦，太厉害了！' : `每行、每列、每宫数字 ${size} 各一个 · 先点格子再选数字`)
    SIZES.forEach((option, i) => this.button(200 + i * 184, 165, `${option === this.size ? '✓ ' : ''}${option} × ${option}`, () => { this.size = option; this.restart() }, 168, this.content))
    const cell = Math.min(96, 505 / size), board = cell * size
    const left = (768 - board) / 2, top = 225 + (505 - board) / 2
    for (let i = 0; i < this.state.values.length; i++) {
      const x = left + i % size * cell, y = top + Math.floor(i / size) * cell
      const given = this.state.puzzle[i] !== 0, wrong = clash.has(i)
      const tile = this.add.rectangle(x + cell / 2, y + cell / 2, cell - 3, cell - 3,
        wrong ? 0xf3c9bd : given ? 0xe9dfca : i === this.selected ? 0xffd982 : 0xfffdf6)
      tile.setStrokeStyle(i === this.selected ? 4 : 2, i === this.selected ? 0xe6b84d : 0xd8cdbb)
      this.content.add(tile)
      if (this.state.values[i]) {
        this.text(x + cell / 2, y + cell / 2, String(this.state.values[i]), cell * 0.48, this.content)
          .setColor(wrong ? '#c0392b' : given ? INK : '#2f6f8f')
      }
      if (!given && !this.state.won) tile.setInteractive({ useHandCursor: true }).on('pointerup', () => { this.selected = i; this.draw() })
    }
    const boxRows = size === 6 ? 2 : size === 9 ? 3 : 2, boxCols = size === 4 ? 2 : size === 6 ? 3 : 3
    const grid = this.add.graphics()
    this.content.add(grid)
    grid.lineStyle(4, 0x527267)
    grid.strokeRect(left, top, board, board)
    for (let r = boxRows; r < size; r += boxRows) grid.lineBetween(left, top + r * cell, left + board, top + r * cell)
    for (let c = boxCols; c < size; c += boxCols) grid.lineBetween(left + c * cell, top, left + c * cell, top + board)
    const step = Math.min(80, 690 / size)
    for (let value = 1; value <= size; value++) {
      this.button(384 + (value - (size + 1) / 2) * step, 780, String(value), () => this.enter(value), step - 12, this.content)
    }
    this.button(96, 855, '擦除', () => this.enter(0), 116, this.content)
    this.button(250, 855, '撤销', () => { this.state = this.history.pop() ?? this.state; this.draw() }, 140, this.content)
    this.button(452, 855, '提示一格', () => {
      const index = this.state.values.findIndex((value, i) => value !== this.state.solution[i])
      if (index >= 0) { this.assisted = true; this.apply(place(this.state, index, this.state.solution[index]!)) }
    }, 176, this.content)
    this.button(660, 855, '新一局', () => this.restart(), 150, this.content)
  }
  private enter(value: number): void {
    if (this.state.won) return
    if (this.selected < 0) { this.say('先点一个白格子，再选下面的数字'); return }
    this.apply(place(this.state, this.selected, value))
  }
  private apply(next: SudokuState): void {
    if (next === this.state) return
    this.history.push(this.state)
    this.state = next
    this.audio.playMove()
    this.draw()
    if (next.won) { this.say(this.assisted ? '提示练习：全部填对啦！' : '独立完成：全部填对啦！'); this.audio.playWin(); recordFlag(`sudoku-${this.state.size}`) }
  }
  private restart(): void { this.assisted = false; this.state = newGame(this.size); this.selected = -1; this.history = []; this.draw() }
}
