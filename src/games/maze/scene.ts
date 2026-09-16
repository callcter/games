import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { DIRECTIONS, neighbor } from '../pipes/core/game'
import { move, newGame, path, undo } from './core/game'
export class MazeScene extends PuzzleScene {
  private size = 5
  private state = newGame()
  private hint = -1
  constructor(audio: GameAudio, exit: () => void) { super('maze', '迷宫探险', audio, exit) }
  protected start(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const d = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(event.key)
      if (d >= 0) { event.preventDefault(); this.step(d) }
    })
    this.draw()
  }
  private step(d: number): void {
    const next = move(this.state, d)
    if (next === this.state) return
    this.state = next; this.hint = -1; this.audio.playMove(); this.draw()
    if (next.won) this.celebrate('小兔子到家啦！')
  }
  private draw(): void {
    this.resetView(`点相邻格子或方向按钮 · 帮小兔子回家 · ${this.state.trail.length} 步`)
    ;[5, 7, 9, 11].forEach((size, i) => this.button(129 + 170 * i, 165, `${this.size === size ? '✓ ' : ''}${size} × ${size}`, () => { this.size = size; this.restart() }, 155, this.content))
    const cell = 500 / this.size, left = 134, top = 230
    this.state.passages.forEach((mask, i) => {
      const x = left + i % this.size * cell, y = top + Math.floor(i / this.size) * cell
      const tile = this.add.rectangle(x + cell / 2, y + cell / 2, cell, cell, i === this.hint ? 0xffd982 : 0xfffdf6)
      this.content.add(tile)
      tile.setInteractive().on('pointerup', () => {
        const d = [0, 1, 2, 3].find(d => neighbor(this.state.player, d, this.size) === i)
        if (d !== undefined) this.step(d)
      })
      const g = this.add.graphics(); this.content.add(g); g.lineStyle(4, 0x527267)
      if (!(mask & DIRECTIONS[0])) g.lineBetween(x, y, x + cell, y)
      if (!(mask & DIRECTIONS[1])) g.lineBetween(x + cell, y, x + cell, y + cell)
      if (!(mask & DIRECTIONS[2])) g.lineBetween(x, y + cell, x + cell, y + cell)
      if (!(mask & DIRECTIONS[3])) g.lineBetween(x, y, x, y + cell)
      if (i === this.state.player) this.text(x + cell / 2, y + cell / 2, '🐰', cell * 0.58, this.content)
      else if (i === this.size * this.size - 1) this.text(x + cell / 2, y + cell / 2, '🏠', cell * 0.58, this.content)
    })
    ;['↑', '→', '↓', '←'].forEach((label, d) => this.button(222 + d * 108, 775, label, () => this.step(d), 96, this.content))
    this.button(160, 850, '撤销', () => { this.state = undo(this.state); this.draw() }, 180, this.content)
    this.button(384, 850, '提示一步', () => { this.hint = path(this.state)[1] ?? -1; this.draw() }, 180, this.content)
    this.button(608, 850, '新迷宫', () => this.restart(), 180, this.content)
  }
  private restart(): void { this.state = newGame(this.size); this.hint = -1; this.draw() }
}
