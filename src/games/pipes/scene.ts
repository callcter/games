import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordRun } from '../puzzle-kit/progress'
import { connected, DIRECTIONS, newGame, turn, won, type PipesState } from './core/game'
import { pipesLayout } from './layout'

export class PipesScene extends PuzzleScene {
  protected override useResponsivePlayArea = true
  private size = 4
  private state = newGame(4)
  private history: PipesState[] = []
  private assisted = false
  constructor(audio: GameAudio, exit: () => void) { super('pipes', '接水管', audio, exit) }
  protected start(): void { this.draw() }
  protected override onPlayAreaResize(): void { this.draw() }
  private draw(): void {
    this.resetView(`点管道旋转 · 从左上水源连通全部格子 · ${this.state.moves} 步`)
    const area = this.playArea({ bottom: 84, horizontalPadding: 54 })
    const layout = pipesLayout(area, this.size)
    ;[4, 5, 6].forEach((size, i) => this.button(160 + 224 * i, layout.modeY, `${size === this.size ? '✓ ' : ''}${size} × ${size}`, () => { this.size = size; this.restart() }, 190, this.content))
    const reached = connected(this.state), cell = layout.cell
    this.state.cells.forEach((mask, index) => {
      const x = layout.boardLeft + index % this.size * cell
      const y = layout.boardTop + Math.floor(index / this.size) * cell
      const tileVisual = this.add.graphics(); this.content.add(tileVisual)
      tileVisual.fillStyle(0x684a34, 0.10)
      tileVisual.fillRoundedRect(x + 4, y + 8, cell - 8, cell - 8, Math.max(12, cell * 0.12))
      tileVisual.fillStyle(reached.has(index) ? 0xe8f4ee : 0xfff8e7, 0.98)
      tileVisual.fillRoundedRect(x + 4, y + 3, cell - 8, cell - 10, Math.max(12, cell * 0.12))
      tileVisual.lineStyle(2, reached.has(index) ? 0x91c7b8 : 0xd8cdbb, 0.70)
      tileVisual.strokeRoundedRect(x + 5, y + 4, cell - 10, cell - 12, Math.max(11, cell * 0.11))
      const tile = this.add.rectangle(x + cell / 2, y + cell / 2, cell - 5, cell - 5, 0xffffff, 0.001)
      this.content.add(tile)
      const g = this.add.graphics(); this.content.add(g)
      g.lineStyle(cell * 0.22, 0x684a34, 0.12)
      DIRECTIONS.forEach((bit, d) => {
        if (mask & bit) g.lineBetween(x + cell / 2 + 2, y + cell / 2 + 4, x + cell / 2 + [0, 1, 0, -1][d]! * cell / 2 + 2, y + cell / 2 + [-1, 0, 1, 0][d]! * cell / 2 + 4)
      })
      g.lineStyle(cell * 0.17, reached.has(index) ? 0x4fa68e : 0x778779)
      DIRECTIONS.forEach((bit, d) => {
        if (mask & bit) g.lineBetween(x + cell / 2, y + cell / 2, x + cell / 2 + [0, 1, 0, -1][d]! * cell / 2, y + cell / 2 + [-1, 0, 1, 0][d]! * cell / 2)
      })
      g.fillStyle(reached.has(index) ? 0x4fa68e : 0x778779); g.fillCircle(x + cell / 2, y + cell / 2, cell * 0.13)
      g.lineStyle(cell * 0.045, reached.has(index) ? 0xc8f1e6 : 0xd5ddd7)
      DIRECTIONS.forEach((bit, d) => {
        if (mask & bit) g.lineBetween(x + cell / 2, y + cell / 2, x + cell / 2 + [0, 1, 0, -1][d]! * cell / 2, y + cell / 2 + [-1, 0, 1, 0][d]! * cell / 2)
      })
      if (index === 0) {
        const source = this.add.graphics(); this.content.add(source)
        source.fillStyle(0xffffff, 0.92)
        source.fillCircle(x + cell / 2, y + cell / 2, cell * 0.20)
        source.lineStyle(2, 0x66bfe3, 0.78)
        source.strokeCircle(x + cell / 2, y + cell / 2, cell * 0.20)
        source.fillStyle(0x66bfe3, 1)
        source.fillCircle(x + cell / 2, y + cell / 2 + cell * 0.035, cell * 0.075)
        source.fillTriangle(
          x + cell / 2,
          y + cell / 2 - cell * 0.10,
          x + cell / 2 - cell * 0.065,
          y + cell / 2 + cell * 0.02,
          x + cell / 2 + cell * 0.065,
          y + cell / 2 + cell * 0.02
        )
      }
      tile.setInteractive().on('pointerup', () => {
        const next = turn(this.state, index)
        if (next === this.state) return
        this.history.push(this.state); this.state = next; this.audio.playMove(); this.draw()
        if (won(next)) this.complete()
      })
    })
    this.button(150, layout.footerY, '撤销', () => { this.state = this.history.pop() ?? this.state; this.draw() }, 180, this.content)
    this.button(384, layout.footerY, '提示', () => {
      const index = this.state.cells.findIndex((mask, i) => mask !== this.state.solution[i])
      if (index < 0) return
      this.assisted = true
      this.history.push(this.state)
      this.state = { ...this.state, moves: this.state.moves + 1, cells: this.state.cells.map((mask, i) => i === index ? this.state.solution[i]! : mask) }
      this.draw(); this.say('已帮你接好一格，试试接下去')
      if (won(this.state)) this.complete()
    }, 180, this.content)
    this.button(618, layout.footerY, '新关卡', () => this.restart(), 180, this.content)
  }
  private complete(): void { this.celebrate(this.assisted ? '提示练习完成啦！' : '独立接通啦！'); recordRun(`pipes-${this.size}`, this.state.moves, this.assisted) }
  private restart(): void { this.assisted = false; this.state = newGame(this.size); this.history = []; this.draw() }
}
