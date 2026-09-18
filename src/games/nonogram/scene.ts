import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { migrateNumberedFlags, recordFlag } from '../puzzle-kit/progress'
import { clues, legacyV2ToV3, lineCells, mark, newGame, PATTERNS, patternSize, solution, type Mark, type NonogramState } from './core/game'
import { restoreNonogram } from '../puzzle-kit/core/drafts'
import { loadGameSave, saveGame } from '../../platform/storage/game-storage'
export class NonogramScene extends PuzzleScene {
  private state = newGame(5)
  private mode: Mark = 1
  private history: NonogramState[] = []
  private assisted = false
  private playing = false
  private stroke: { value: Mark; last: number; seen: Set<number> } | null = null
  private tiles: Phaser.GameObjects.Rectangle[] = []
  private crosses: Phaser.GameObjects.Text[] = []
  private rowClues: Phaser.GameObjects.Text[] = []
  private columnClues: Phaser.GameObjects.Text[] = []
  constructor(audio: GameAudio, exit: () => void) { super('nonogram', '数织', audio, exit) }
  protected start(): void {
    // 已发布交错版完成记录迁移到当前编号（≥9 无歧义；0-8 两代同义保留原样）。
    migrateNumberedFlags('nonogram', 9, legacyV2ToV3)
    // 三代编号兼容策略（二轮验收 R2）：无法可靠区分的无版本号旧档按原身份保守恢复；
    // 进入游戏时把现有草档原样备份一次，迁移万一误判也不丢原始进度。
    void this.backupLegacyDraft()
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.playing || this.state.won) return
      const i = this.cellAt(p)
      if (i < 0) return
      this.history.push(this.state)
      this.stroke = { value: this.state.marks[i] === this.mode ? 0 : this.mode, last: i, seen: new Set() }
      this.paint(p)
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.stroke && p.isDown) this.paint(p) })
    const finish = (): void => { this.stroke = null }
    this.input.on('pointerup', finish)
    this.input.on('pointerupoutside', finish)
    this.input.on('gameout', finish)
    void this.offerResume('nonogram', restoreNonogram, saved => {
      this.state = saved.state; this.history = saved.history; this.assisted = saved.assisted; this.draw()
    }, () => { this.state = newGame(0); this.history = []; this.assisted = false; this.draw() })
  }
  /** 无版本号旧档的一次性原样备份（迁移误判时的最后防线）。 */
  private async backupLegacyDraft(): Promise<void> {
    if (!this.alive) return
    try {
      const backupKey = 'game-puzzle-draft-nonogram-v1-backup'
      const existing = await loadGameSave<unknown>(backupKey)
      if (existing !== null && existing !== undefined) return
      const raw = await loadGameSave<unknown>('game-puzzle-draft-nonogram-v1')
      if (raw !== null && raw !== undefined) await saveGame(backupKey, raw)
    } catch {
      // 存储不可用时跳过备份，不影响开局。
    }
  }

  private draw(): void {
    this.playing = true
    this.stroke = null
    this.history = this.history.slice(-50)
    this.remember('nonogram', { state: this.state, history: this.history, assisted: this.assisted })
    const level = this.state.level, size = patternSize(level), target = solution(level)
    const cell = size === 5 ? 84 : 52
    const boardLeft = size === 5 ? 225 : 200, boardTop = size === 5 ? 310 : 230
    this.resetView(`第 ${level + 1} / ${PATTERNS.length} 幅 · 数字表示连续填色格数`)
    this.tiles = []; this.crosses = []; this.rowClues = []; this.columnClues = []
    this.text(384, size === 5 ? 157 : 137, '可以按住划格 · 一次撤销一整笔 · 淡色线索表示已凑齐', 18, this.content)
    const bands = this.add.graphics()
    bands.fillStyle(0xe6ebde)
    bands.fillRoundedRect(boardLeft, boardTop - (size === 5 ? 84 : 68), cell * size, size === 5 ? 76 : 60, 12)
    bands.fillRoundedRect(boardLeft - (size === 5 ? 84 : 108), boardTop, size === 5 ? 76 : 100, cell * size, 12)
    this.content.add(bands)
    for (let i = 0; i < size; i++) {
      this.rowClues.push(this.text(boardLeft - (size === 5 ? 44 : 55), boardTop + i * cell + cell / 2, clues(target.slice(i * size, i * size + size)).join(' '), size === 5 ? 25 : 16, this.content))
      this.columnClues.push(this.text(boardLeft + i * cell + cell / 2, boardTop - (size === 5 ? 44 : 38), clues(Array.from({ length: size }, (_, y) => target[y * size + i]!)).join('\n'), size === 5 ? 24 : 15, this.content))
    }
    this.state.marks.forEach((value, index) => {
      const x = boardLeft + index % size * cell + cell / 2, y = boardTop + Math.floor(index / size) * cell + cell / 2
      const tile = this.add.rectangle(x, y, cell - 4, cell - 4, value === 1 ? (this.state.won ? 0xe88065 : 0x58a897) : 0xfffdf6).setStrokeStyle(2, 0xd8cdbb)
      this.content.add(tile)
      this.tiles.push(tile)
      this.crosses.push(this.text(x, y, '×', cell * 0.7, this.content).setVisible(value === -1))
    })
    this.button(180, 780, this.mode === 1 ? '✓ 填色' : '填色', () => { this.mode = 1; this.draw() }, 150, this.content)
    this.button(370, 780, this.mode === -1 ? '✓ 标空' : '标空', () => { this.mode = -1; this.draw() }, 150, this.content)
    this.button(570, 780, '提示一格', () => {
      const i = target.findIndex((v, i) => v === 1 ? this.state.marks[i] !== 1 : this.state.marks[i] === 1)
      if (i >= 0) { this.assisted = true; this.change(i, target[i] ? 1 : -1) }
    }, 180, this.content)
    this.button(160, 850, '撤销', () => { this.state = this.history.pop() ?? this.state; this.draw() }, 180, this.content)
    this.button(384, 850, '重开', () => { this.state = newGame(this.state.level); this.history = []; this.assisted = false; this.draw() }, 180, this.content)
    this.button(608, 850, '下一幅', () => { this.state = newGame(this.state.level < PATTERNS.length - 1 ? this.state.level + 1 : 0); this.history = []; this.assisted = false; this.draw() }, 180, this.content)
    this.updateBoard()
  }
  private updateBoard(): void {
    const size = patternSize(this.state.level), target = solution(this.state.level)
    this.state.marks.forEach((value,i) => {
      this.tiles[i]!.setFillStyle(value === 1 ? (this.state.won ? 0xe88065 : 0x58a897) : 0xfffdf6)
      this.crosses[i]!.setVisible(value === -1)
    })
    for (let i = 0; i < size; i++) {
      const row = (array: readonly number[]): number[] => array.slice(i*size, i*size+size)
      const col = (array: readonly number[]): number[] => Array.from({length:size}, (_,y) => array[y*size+i]!)
      this.rowClues[i]!.setAlpha(clues(row(this.state.marks)).join() === clues(row(target)).join() ? 0.45 : 1)
      this.columnClues[i]!.setAlpha(clues(col(this.state.marks)).join() === clues(col(target)).join() ? 0.45 : 1)
    }
    if (this.state.won) this.say(`${this.assisted ? '提示练习' : '独立完成'}：${PATTERNS[this.state.level]!.name}！`)
  }
  private cellAt(p: Phaser.Input.Pointer): number {
    const size = patternSize(this.state.level), cell = size === 5 ? 84 : 52
    const x = Math.floor((p.x - (size === 5 ? 225 : 200))/cell), y = Math.floor((p.y - (size === 5 ? 310 : 230))/cell)
    return x >= 0 && y >= 0 && x < size && y < size ? y*size+x : -1
  }
  private paint(p: Phaser.Input.Pointer): void {
    const stroke = this.stroke
    if (!stroke) return
    const index = this.cellAt(p)
    if (index < 0) { stroke.last = -1; return }
    for (const i of stroke.last < 0 ? [index] : lineCells(stroke.last, index, patternSize(this.state.level))) {
      if (stroke.seen.has(i)) continue
      stroke.seen.add(i); this.change(i, stroke.value, false)
    }
    stroke.last = index
  }
  private change(index: number, value: Mark, history = true): void {
    const next = mark(this.state, index, value)
    if (next === this.state) return
    if (history) this.history.push(this.state)
    this.state = next; this.history = this.history.slice(-50)
    this.audio.playMove(); this.updateBoard()
    this.remember('nonogram', { state: this.state, history: this.history, assisted: this.assisted })
    if (next.won) { this.audio.playWin(); recordFlag(`nonogram-${this.state.level}`) }
  }
}
