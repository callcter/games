import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { loadProgress, recordRun, recordLevel } from '../puzzle-kit/progress'
import { CHALLENGE_LEVELS, LEVELS, move, newGame, PAR, solve, stars, type SokobanState } from './core/game'
import { restoreSokoban } from '../puzzle-kit/core/drafts'
export class SokobanScene extends PuzzleScene {
  private level = 0
  private state = newGame()
  private history: SokobanState[] = []
  private view: 'levels' | 'play' = 'levels'
  private bestMoves: Record<number, number> = {}
  private assisted = false
  private practice = new Set<number>()
  constructor(audio: GameAudio, exit: () => void) { super('sokoban', '推箱子', audio, exit) }
  protected start(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const d = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(event.key)
      if (d >= 0) { event.preventDefault(); this.step(d) }
    })
    void loadProgress().then(progress => {
      if (!this.alive) return
      this.level = Math.min(progress.levels.sokoban ?? 0, LEVELS.length - 1)
      for (const [key, value] of Object.entries(progress.best)) {
        const match = /^sokoban-L(\d+):solo$/.exec(key)
        if (match) this.bestMoves[Number(match[1])] = value
        const practice = /^sokoban-L(\d+)(?::assisted)?$/.exec(key)
        if (practice) this.practice.add(Number(practice[1]))
      }
      void this.offerResume('sokoban', restoreSokoban, saved => {
        this.level = saved.level; this.state = saved.state; this.history = saved.history; this.assisted = saved.assisted; this.draw()
      }, () => this.showLevels())
    })
  }
  private showLevels(): void {
    this.view = 'levels'
    this.resetView(`独立完成 ${CHALLENGE_LEVELS.filter(level=>this.bestMoves[level]!==undefined).length} / ${CHALLENGE_LEVELS.length} 关 · 点一个关卡开始`)
    this.text(384, 170, '用的步数越少，星星越多', 20, this.content)
    CHALLENGE_LEVELS.forEach((level, index) => {
      const best = this.bestMoves[level]
      const label = best === undefined ? `${level + 1}${this.practice.has(level) ? ' ✓' : ''}` : `${level + 1} ${'★'.repeat(stars(level, best))}`
      this.button(128 + index % 5 * 128, 300 + Math.floor(index / 5) * 150, label, () => { this.level = level; this.restart() }, 108, this.content)
    })
  }
  private step(d: number): void {
    if (this.view !== 'play') return
    const next = move(this.state, d)
    if (next === this.state) return
    this.history.push(this.state); this.state = next; this.audio.playMove(); this.draw()
    if (next.won) {
      const earned = stars(this.level, next.moves)
      this.celebrate(this.assisted ? '提示练习完成啦！下次试试自己来' : `独立完成！得到 ${'★'.repeat(earned)}`)
      if (this.assisted) this.practice.add(this.level)
      else if (this.bestMoves[this.level] === undefined || next.moves < this.bestMoves[this.level]!) this.bestMoves[this.level] = next.moves
      recordRun(`sokoban-L${this.level}`, next.moves, this.assisted)
      recordLevel('sokoban', CHALLENGE_LEVELS.find(level=>level>this.level) ?? LEVELS.length-1)
    }
  }
  private draw(): void {
    this.history = this.history.slice(-50)
    this.remember('sokoban', { level: this.level, state: this.state, history: this.history, assisted: this.assisted })
    this.view = 'play'
    this.resetView(`第 ${this.level + 1} / ${LEVELS.length} 关 · ${PAR[this.level]} 步内三星 · 已走 ${this.state.moves} 步`)
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
    this.button(96, 850, '撤销', () => { this.state = this.history.pop() ?? this.state; this.draw() }, 110, this.content)
    this.button(250, 850, '提示一步', () => {
      const route = solve(this.state)
      if (route?.length) { this.assisted = true; this.step(route[0]!) }
      else if (!this.state.won) this.say('箱子被困住啦，试试撤销或重开')
    }, 150, this.content)
    this.button(430, 850, '重开', () => this.restart(), 110, this.content)
    this.button(588, 850, '选关', () => this.showLevels(), 132, this.content)
    if (this.state.won && this.level < LEVELS.length - 1) this.button(384, 700, '下一关 →', () => { this.level = CHALLENGE_LEVELS.find(level=>level>this.level) ?? LEVELS.length-1; this.restart() }, 220, this.content)
    if (this.state.won && this.level === LEVELS.length - 1) this.text(384, 700, '全部通关啦，去选关页刷新纪录吧！', 24, this.content)
  }
  private restart(): void { this.assisted = false; this.state = newGame(this.level); this.history = []; this.draw() }
}
