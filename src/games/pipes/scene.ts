import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordRun } from '../puzzle-kit/progress'
import { connected, DIRECTIONS, newGame, turn, won, type PipesState } from './core/game'

export class PipesScene extends PuzzleScene {
  private size = 4
  private state = newGame(4)
  private history: PipesState[] = []
  private assisted = false
  constructor(audio: GameAudio, exit: () => void) { super('pipes', '接水管', audio, exit) }
  protected start(): void { this.draw() }
  private draw(): void {
    this.resetView(`点管道旋转 · 从左上水源连通全部格子 · ${this.state.moves} 步`)
    ;[4, 5, 6].forEach((size, i) => this.button(160 + 224 * i, 165, `${size === this.size ? '✓ ' : ''}${size} × ${size}`, () => { this.size = size; this.restart() }, 190, this.content))
    const reached = connected(this.state), cell = 570 / this.size
    this.state.cells.forEach((mask, index) => {
      const x = 99 + index % this.size * cell, y = 240 + Math.floor(index / this.size) * cell
      const tile = this.add.rectangle(x + cell / 2, y + cell / 2, cell - 5, cell - 5, reached.has(index) ? 0xd4ece3 : 0xe9dfca)
      this.content.add(tile)
      const g = this.add.graphics(); this.content.add(g)
      g.lineStyle(cell * 0.17, reached.has(index) ? 0x58a897 : 0xa49e8e)
      DIRECTIONS.forEach((bit, d) => {
        if (mask & bit) g.lineBetween(x + cell / 2, y + cell / 2, x + cell / 2 + [0, 1, 0, -1][d]! * cell / 2, y + cell / 2 + [-1, 0, 1, 0][d]! * cell / 2)
      })
      g.fillStyle(reached.has(index) ? 0x58a897 : 0xa49e8e); g.fillCircle(x + cell / 2, y + cell / 2, cell * 0.13)
      if (index === 0) this.text(x + cell / 2, y + cell / 2, '💧', cell * 0.3, this.content)
      tile.setInteractive().on('pointerup', () => {
        const next = turn(this.state, index)
        if (next === this.state) return
        this.history.push(this.state); this.state = next; this.audio.playMove(); this.draw()
        if (won(next)) this.complete()
      })
    })
    this.button(150, 850, '撤销', () => { this.state = this.history.pop() ?? this.state; this.draw() }, 180, this.content)
    this.button(384, 850, '提示', () => {
      const index = this.state.cells.findIndex((mask, i) => mask !== this.state.solution[i])
      if (index < 0) return
      this.assisted = true
      this.history.push(this.state)
      this.state = { ...this.state, moves: this.state.moves + 1, cells: this.state.cells.map((mask, i) => i === index ? this.state.solution[i]! : mask) }
      this.draw(); this.say('已帮你接好一格，试试接下去')
      if (won(this.state)) this.complete()
    }, 180, this.content)
    this.button(618, 850, '新关卡', () => this.restart(), 180, this.content)
  }
  private complete(): void { this.celebrate(this.assisted ? '提示练习完成啦！' : '独立接通啦！'); recordRun(`pipes-${this.size}`, this.state.moves, this.assisted) }
  private restart(): void { this.assisted = false; this.state = newGame(this.size); this.history = []; this.draw() }
}
