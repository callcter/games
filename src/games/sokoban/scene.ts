import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { LEVELS, move, newGame, solve, type SokobanState } from './core/game'
export class SokobanScene extends PuzzleScene {
  private level = 0
  private state = newGame()
  private history: SokobanState[] = []
  constructor(audio: GameAudio, exit: () => void) { super('sokoban', '推箱子', audio, exit) }
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
    this.history.push(this.state); this.state = next; this.audio.playMove(); this.draw()
    if (next.won) this.celebrate('箱子都到家啦！')
  }
  private draw(): void {
    this.resetView(`第 ${this.level + 1} / ${LEVELS.length} 关 · 把箱子推到圆点上 · ${this.state.moves} 步`)
    this.text(384, 165, '只能推，不能拉；推错了可以撤销', 21, this.content)
    const cell = Math.min(76, 470 / this.state.height, 660 / this.state.width)
    const left = (768 - this.state.width * cell) / 2, top = 225
    for (let i = 0; i < this.state.width * this.state.height; i++) {
      const x = left + i % this.state.width * cell + cell / 2, y = top + Math.floor(i / this.state.width) * cell + cell / 2
      const wall = this.state.walls.includes(i)
      const tile = this.add.rectangle(x, y, cell - 3, cell - 3, wall ? 0x527267 : 0xe9dfca)
      this.content.add(tile)
      if (this.state.goals.includes(i)) { const dot = this.add.circle(x, y, Math.min(15, cell * 0.22), 0xe6b84d); this.content.add(dot) }
      if (this.state.boxes.includes(i)) this.text(x, y, this.state.goals.includes(i) ? '✅' : '📦', Math.min(44, cell * 0.6), this.content)
      if (i === this.state.player) this.text(x, y, '🐱', Math.min(44, cell * 0.6), this.content)
      tile.setInteractive().on('pointerup', () => {
        const d = [-this.state.width, 1, this.state.width, -1].findIndex(offset => this.state.player + offset === i)
        if (d >= 0) this.step(d)
      })
    }
    ;['↑', '→', '↓', '←'].forEach((label, d) => this.button(204 + d * 120, 740, label, () => this.step(d), 100, this.content))
    this.button(104, 850, '撤销', () => { this.state = this.history.pop() ?? this.state; this.draw() }, 132, this.content)
    this.button(288, 850, '提示一步', () => {
      const route = solve(this.state)
      if (route?.length) this.step(route[0]!)
      else if (!this.state.won) this.say('箱子被困住啦，试试撤销或重开')
    }, 170, this.content)
    this.button(482, 850, '重开', () => this.restart(), 132, this.content)
    this.button(664, 850, '下一关', () => { this.level = (this.level + 1) % LEVELS.length; this.restart() }, 150, this.content)
  }
  private restart(): void { this.state = newGame(this.level); this.history = []; this.draw() }
}
