import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { connected, DIRECTIONS, newGame, turn, won, type PipesState } from './core/game'

export class PipesScene extends PuzzleScene {
  private size = 3
  private state = newGame(3)
  private history: PipesState[] = []
  constructor(audio: GameAudio, exit: () => void) { super('pipes', '接水管', audio, exit) }
  protected start(): void { this.draw() }
  private draw(): void {
    this.resetView(`点管道旋转 · 从左上水源连通全部格子 · ${this.state.moves} 步`)
    ;[3, 4, 5].forEach((size, i) => this.button(170 + i * 214, 165, `${size === this.size ? '✓ ' : ''}${size} × ${size}`, () => { this.size = size; this.restart() }, 180, this.content))
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
        if (won(next)) this.celebrate('水流通啦，小树喝到水了！')
      })
    })
    this.button(150, 850, '撤销', () => { this.state = this.history.pop() ?? this.state; this.draw() }, 180, this.content)
    this.button(384, 850, '提示', () => {
      const index = this.state.cells.findIndex((mask, i) => mask !== this.state.solution[i])
      if (index < 0) return
      this.history.push(this.state)
      this.state = { ...this.state, cells: this.state.cells.map((mask, i) => i === index ? this.state.solution[i]! : mask) }
      this.draw(); this.say('已帮你接好一格，试试接下去')
      if (won(this.state)) this.celebrate()
    }, 180, this.content)
    this.button(618, 850, '新关卡', () => this.restart(), 180, this.content)
  }
  private restart(): void { this.state = newGame(this.size); this.history = []; this.draw() }
}
