import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { loadProgress, recordRun, recordLevel } from '../puzzle-kit/progress'
import { LEVELS, move, newGame, PAR, solve, stars, type SokobanState } from './core/game'
import { restoreSokoban } from '../puzzle-kit/core/drafts'
import { PRODUCT_V3, preloadSokobanV3 } from '../../platform/display/product-v3-art'
import { sokobanLevelLayout, sokobanPlayLayout } from './layout'
export class SokobanScene extends PuzzleScene {
  protected override useResponsivePlayArea = true
  private level = 0
  private state = newGame()
  private history: SokobanState[] = []
  private view: 'levels' | 'play' = 'levels'
  private bestMoves: Record<number, number> = {}
  private assisted = false
  private practice = new Set<number>()
  private resumeResolved = false

  constructor(audio: GameAudio, exit: () => void) { super('sokoban', '推箱子', audio, exit) }
  preload(): void { preloadSokobanV3(this) }
  protected override onPlayAreaResize(): void {
    if (!this.resumeResolved) return
    if (this.view === 'play') this.draw()
    else this.showLevels()
  }
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
        this.resumeResolved = true
        this.level = saved.level; this.state = saved.state; this.history = saved.history; this.assisted = saved.assisted; this.draw()
      }, () => {
        this.resumeResolved = true
        this.showLevels()
      })
    })
  }
  private showLevels(): void {
    this.view = 'levels'
    // 全部关卡可选（Wave 4 扩容后学习关与挑战关都应有入口），挑战关带 ☆ 前缀。
    const cleared = LEVELS.filter((_, level) => this.bestMoves[level] !== undefined).length
    this.resetView(`独立完成 ${cleared} / ${LEVELS.length} 关 · 点一个关卡开始`)
    const area = this.playArea({ bottom: 76, horizontalPadding: 40 })
    const layout = sokobanLevelLayout(area, LEVELS.length)
    this.text(
      384,
      layout.instructionY,
      '☆ 是挑战关 · 用的步数越少星星越多',
      this.contentFont(20, 15),
      this.content
    )
    LEVELS.forEach((_, level) => {
      const best = this.bestMoves[level]
      const challenge = (PAR[level] ?? 0) >= 8 ? '☆' : ''
      const rating = best === undefined ? '' : '★'.repeat(stars(level, best))
      const label = area.phoneLike && rating
        ? `${challenge}${level + 1}\n${rating}`
        : best === undefined
          ? `${challenge}${level + 1}${this.practice.has(level) ? ' ✓' : ''}`
          : `${challenge}${level + 1} ${rating}`
      const col = level % layout.cols
      const row = Math.floor(level / layout.cols)
      this.button(
        layout.firstX + col * layout.columnStep,
        layout.firstY + row * layout.rowStep,
        label,
        () => { this.level = level; this.restart() },
        layout.buttonWidth,
        this.content
      )
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
      recordLevel('sokoban', Math.min(this.level + 1, LEVELS.length - 1))
    }
  }
  private draw(): void {
    this.history = this.history.slice(-50)
    this.remember('sokoban', { level: this.level, state: this.state, history: this.history, assisted: this.assisted })
    this.view = 'play'
    this.resetView(`第 ${this.level + 1} / ${LEVELS.length} 关 · ${PAR[this.level]} 步内三星 · 已走 ${this.state.moves} 步`)
    const area = this.playArea({ bottom: 76, horizontalPadding: 40 })
    const layout = sokobanPlayLayout(area, this.state.width, this.state.height)
    this.text(
      384,
      layout.instructionY,
      '只能推，不能拉；推错了可以撤销',
      this.contentFont(21, 15.5),
      this.content
    )
    const { cell } = layout
    const left = layout.boardLeft, top = layout.boardTop
    for (let i = 0; i < this.state.width * this.state.height; i++) {
      const x = left + i % this.state.width * cell + cell / 2, y = top + Math.floor(i / this.state.width) * cell + cell / 2
      const wall = this.state.walls.includes(i)
      const tile = this.add.rectangle(x, y, cell - 3, cell - 3, wall ? 0x527267 : 0xe9dfca)
      this.content.add(tile)
      if (wall && this.textures.exists(PRODUCT_V3.sokoban.sprites)) {
        this.content.add(this.add.image(x, y, PRODUCT_V3.sokoban.sprites, 3).setDisplaySize(cell * 0.92, cell * 0.92))
      }
      if (this.state.goals.includes(i)) {
        if (this.textures.exists(PRODUCT_V3.sokoban.sprites)) this.content.add(this.add.image(x, y, PRODUCT_V3.sokoban.sprites, 2).setDisplaySize(cell * 0.70, cell * 0.70))
        else { const dot = this.add.circle(x, y, Math.min(15, cell * 0.22), 0xe6b84d); this.content.add(dot) }
      }
      if (this.state.boxes.includes(i)) {
        if (this.textures.exists(PRODUCT_V3.sokoban.sprites)) this.content.add(this.add.image(x, y, PRODUCT_V3.sokoban.sprites, 1).setDisplaySize(cell * 0.78, cell * 0.78))
        else this.text(x, y, this.state.goals.includes(i) ? '✅' : '📦', Math.min(44, cell * 0.6), this.content)
      }
      if (i === this.state.player) {
        if (this.textures.exists(PRODUCT_V3.sokoban.sprites)) this.content.add(this.add.image(x, y, PRODUCT_V3.sokoban.sprites, 0).setDisplaySize(cell * 0.78, cell * 0.78))
        else this.text(x, y, '🐱', Math.min(44, cell * 0.6), this.content)
      }
      tile.setInteractive().on('pointerup', () => {
        const d = [-this.state.width, 1, this.state.width, -1].findIndex(offset => this.state.player + offset === i)
        if (d >= 0) this.step(d)
      })
    }
    ;['↑', '→', '↓', '←'].forEach((label, d) => this.button(204 + d * 120, layout.directionY, label, () => this.step(d), 100, this.content))
    this.button(96, layout.footerY, '撤销', () => { this.state = this.history.pop() ?? this.state; this.draw() }, 110, this.content)
    this.button(250, layout.footerY, '提示一步', () => {
      const route = solve(this.state)
      if (route?.length) { this.assisted = true; this.step(route[0]!) }
      else if (!this.state.won) this.say('箱子被困住啦，试试撤销或重开')
    }, 150, this.content)
    this.button(430, layout.footerY, '重开', () => this.restart(), 110, this.content)
    this.button(588, layout.footerY, '选关', () => this.showLevels(), 132, this.content)
    if (this.state.won && this.level < LEVELS.length - 1) this.button(384, layout.nextY, '下一关 →', () => { this.level = this.level + 1; this.restart() }, 220, this.content)
    if (this.state.won && this.level === LEVELS.length - 1) this.text(
      384,
      layout.nextY,
      '全部通关啦，去选关页刷新纪录吧！',
      this.contentFont(24, 15),
      this.content
    )
  }
  private restart(): void { this.assisted = false; this.state = newGame(this.level); this.history = []; this.draw() }
}
