import type { GameAudio } from '../../platform/audio/game-audio'
import { PRODUCT_V3, preloadSokobanV3 } from '../../platform/display/product-v3-art'
import { PuzzleScene } from '../puzzle-kit/scene'
import { restoreSokoban } from '../puzzle-kit/core/drafts'
import { loadProgress, recordLevel, recordRun } from '../puzzle-kit/progress'
import { SokobanBoardView } from './board-view'
import {
  LEVELS,
  move,
  newGame,
  PAR,
  solve,
  stars,
  type SokobanState
} from './core/game'
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
  private board?: SokobanBoardView
  private busy = false
  private resumeResolved = false
  private viewRevision = 0

  constructor(audio: GameAudio, exit: () => void) {
    super('sokoban', '推箱子', audio, exit)
  }

  preload(): void {
    preloadSokobanV3(this)
  }

  protected start(): void {
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const direction = [
        'ArrowUp',
        'ArrowRight',
        'ArrowDown',
        'ArrowLeft'
      ].indexOf(event.key)

      if (direction >= 0) {
        event.preventDefault()
        this.step(direction)
      }
    })

    void loadProgress().then(progress => {
      if (!this.alive) return

      this.level = Math.min(
        progress.levels.sokoban ?? 0,
        LEVELS.length - 1
      )

      for (const [key, value] of Object.entries(progress.best)) {
        const match = /^sokoban-L(\d+):solo$/.exec(key)
        if (match) this.bestMoves[Number(match[1])] = value

        const practice = /^sokoban-L(\d+)(?::assisted)?$/.exec(key)
        if (practice) this.practice.add(Number(practice[1]))
      }

      void this.offerResume(
        'sokoban',
        restoreSokoban,
        saved => {
          this.resumeResolved = true
          this.level = saved.level
          this.state = saved.state
          this.history = saved.history
          this.assisted = saved.assisted
          this.buildPlayView()
        },
        () => {
          this.resumeResolved = true
          this.showLevels()
        }
      )
    })
  }

  protected override onPlayAreaResize(): void {
    if (!this.resumeResolved) return
    if (this.view === 'play') this.buildPlayView()
    else this.showLevels()
  }

  private showLevels(): void {
    if (this.busy) return
    this.view = 'levels'
    this.busy = false
    this.board = undefined
    this.viewRevision += 1

    const cleared = LEVELS.filter(
      (_, level) => this.bestMoves[level] !== undefined
    ).length

    const area = this.playArea({
      bottom: 76,
      horizontalPadding: 40
    })
    const layout = sokobanLevelLayout(area, LEVELS.length)

    this.resetView(
      `独立完成 ${cleared} / ${LEVELS.length} 关 · 点一个关卡开始`
    )

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
      const rating = best === undefined
        ? ''
        : '★'.repeat(stars(level, best))

      const label = area.phoneLike && rating
        ? `${challenge}${level + 1}\n${rating}`
        : best === undefined
          ? `${challenge}${level + 1}${this.practice.has(level) ? ' ✓' : ''}`
          : `${challenge}${level + 1} ${rating}`

      const column = level % layout.cols
      const row = Math.floor(level / layout.cols)

      this.button(
        layout.firstX + column * layout.columnStep,
        layout.firstY + row * layout.rowStep,
        label,
        () => {
          this.level = level
          this.restart()
        },
        layout.buttonWidth,
        this.content
      )
    })
  }

  private buildPlayView(): void {
    this.view = 'play'
    this.busy = false
    this.viewRevision += 1
    this.trimAndRemember()

    const area = this.playArea({
      bottom: 76,
      horizontalPadding: 40
    })
    const layout = sokobanPlayLayout(
      area,
      this.state.width,
      this.state.height
    )

    this.resetView(this.statusLine())

    this.text(
      384,
      layout.instructionY,
      '只能推，不能拉；推错了可以撤销',
      this.contentFont(21, 15.5),
      this.content
    )

    this.board = new SokobanBoardView(
      this,
      this.content,
      layout,
      PRODUCT_V3.sokoban.sprites,
      this.state,
      index => {
        const direction = [
          -this.state.width,
          1,
          this.state.width,
          -1
        ].findIndex(offset => this.state.player + offset === index)

        if (direction >= 0) this.step(direction)
      }
    )

    ;['↑', '→', '↓', '←'].forEach((label, direction) => {
      this.button(
        204 + direction * 120,
        layout.directionY,
        label,
        () => this.step(direction),
        100,
        this.content
      )
    })

    this.button(
      96,
      layout.footerY,
      '撤销',
      () => this.undoMove(),
      110,
      this.content
    )

    this.button(
      250,
      layout.footerY,
      '提示一步',
      () => this.hintOne(),
      150,
      this.content
    )

    this.button(
      430,
      layout.footerY,
      '重开',
      () => this.restart(),
      110,
      this.content
    )

    this.button(
      588,
      layout.footerY,
      '选关',
      () => this.showLevels(),
      132,
      this.content
    )

    if (this.state.won) this.addWinAction(layout.nextY)
  }

  private step(direction: number): void {
    if (
      this.view !== 'play' ||
      this.busy ||
      this.state.won
    ) return

    const previous = this.state
    const next = move(previous, direction)
    if (next === previous) return

    this.history.push(previous)
    this.state = next
    this.audio.playMove()
    this.say(this.statusLine())
    this.trimAndRemember()

    if (!this.board) {
      this.buildPlayView()
      return
    }

    this.busy = true
    const revision = this.viewRevision
    this.board.animate(previous, next, () => {
      if (revision !== this.viewRevision) return
      this.busy = false
      if (next.won) this.finishWin()
    })
  }

  private undoMove(): void {
    if (this.busy || this.view !== 'play') return

    const previous = this.history.pop()
    if (!previous) return

    const current = this.state
    this.state = previous
    this.say(this.statusLine())
    this.trimAndRemember()

    if (!this.board) {
      this.buildPlayView()
      return
    }

    this.busy = true
    const revision = this.viewRevision
    this.board.animate(current, previous, () => {
      if (revision !== this.viewRevision) return
      this.busy = false
    })
  }

  private hintOne(): void {
    if (this.busy || this.state.won) return

    const route = solve(this.state)
    if (route?.length) {
      this.assisted = true
      this.step(route[0]!)
      return
    }

    this.say('箱子被困住啦，试试撤销或重开')
  }

  private finishWin(): void {
    const earned = stars(this.level, this.state.moves)

    this.celebrate(
      this.assisted
        ? '提示练习完成啦！下次试试自己来'
        : `独立完成！得到 ${'★'.repeat(earned)}`
    )

    if (this.assisted) {
      this.practice.add(this.level)
    } else if (
      this.bestMoves[this.level] === undefined ||
      this.state.moves < this.bestMoves[this.level]!
    ) {
      this.bestMoves[this.level] = this.state.moves
    }

    recordRun(
      `sokoban-L${this.level}`,
      this.state.moves,
      this.assisted
    )
    recordLevel(
      'sokoban',
      Math.min(this.level + 1, LEVELS.length - 1)
    )

    const area = this.playArea({
      bottom: 76,
      horizontalPadding: 40
    })
    const layout = sokobanPlayLayout(
      area,
      this.state.width,
      this.state.height
    )
    this.addWinAction(layout.nextY)
  }

  private addWinAction(y: number): void {
    if (this.level < LEVELS.length - 1) {
      this.button(
        384,
        y,
        '下一关 →',
        () => {
          this.level += 1
          this.restart()
        },
        220,
        this.content
      )
      return
    }

    this.text(
      384,
      y,
      '全部通关啦，去选关页刷新纪录吧！',
      this.contentFont(24, 15),
      this.content
    )
  }

  private restart(): void {
    if (this.busy) return
    this.assisted = false
    this.state = newGame(this.level)
    this.history = []
    this.buildPlayView()
  }

  private trimAndRemember(): void {
    this.history = this.history.slice(-50)
    this.remember('sokoban', {
      level: this.level,
      state: this.state,
      history: this.history,
      assisted: this.assisted
    })
  }

  private statusLine(): string {
    return `第 ${this.level + 1} / ${LEVELS.length} 关 · ${
      PAR[this.level]
    } 步内三星 · 已走 ${this.state.moves} 步`
  }
}
