import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordRun } from '../puzzle-kit/progress'
import {
  connected,
  newGame,
  turn,
  won,
  type PipesState
} from './core/game'
import { pipesLayout } from './layout'
import { PipeTileView } from './pipe-tile-view'
import { pipeQuarterTurnDelta } from './view-model'

export class PipesScene extends PuzzleScene {
  protected override useResponsivePlayArea = true

  private size = 4
  private state = newGame(4)
  private history: PipesState[] = []
  private assisted = false
  private tileViews: PipeTileView[] = []
  private busy = false
  private viewRevision = 0

  constructor(audio: GameAudio, exit: () => void) {
    super('pipes', '接水管', audio, exit)
  }

  protected start(): void {
    this.buildView()
  }

  protected override onPlayAreaResize(): void {
    this.buildView()
  }

  private buildView(): void {
    this.busy = false
    this.viewRevision += 1

    const area = this.playArea({ bottom: 84, horizontalPadding: 54 })
    const layout = pipesLayout(area, this.size)
    const reached = connected(this.state)

    this.resetView(this.statusLine())
    this.tileViews = []

    ;[4, 5, 6].forEach((size, index) => {
      this.button(
        160 + 224 * index,
        layout.modeY,
        `${size === this.size ? '✓ ' : ''}${size} × ${size}`,
        () => {
          this.size = size
          this.restart()
        },
        190,
        this.content
      )
    })

    this.state.cells.forEach((mask, index) => {
      const x = layout.boardLeft +
        (index % this.size) * layout.cell +
        layout.cell / 2
      const y = layout.boardTop +
        Math.floor(index / this.size) * layout.cell +
        layout.cell / 2

      const view = new PipeTileView(
        this,
        x,
        y,
        layout.cell,
        index === 0,
        () => this.handleTurn(index)
      )
      this.content.add(view.container)
      view.sync(mask, reached.has(index))
      this.tileViews[index] = view
    })

    this.button(
      150,
      layout.footerY,
      '撤销',
      () => this.undoMove(),
      180,
      this.content
    )

    this.button(
      384,
      layout.footerY,
      '提示',
      () => this.hintOne(),
      180,
      this.content
    )

    this.button(
      618,
      layout.footerY,
      '新关卡',
      () => this.restart(),
      180,
      this.content
    )
  }

  private handleTurn(index: number): void {
    if (this.busy) return

    const previous = this.state
    const next = turn(previous, index)
    if (next === previous) return

    this.history.push(previous)
    this.state = next
    this.audio.playMove()
    this.say(this.statusLine())

    this.animateCellTransition(previous, next, index, () => {
      if (won(next)) this.complete()
    })
  }

  private undoMove(): void {
    if (this.busy) return

    const previous = this.history.pop()
    if (!previous) return

    const current = this.state
    const index = current.cells.findIndex(
      (mask, cellIndex) => mask !== previous.cells[cellIndex]
    )

    this.state = previous
    this.say(this.statusLine())

    if (index < 0) {
      this.syncConnectivity(connected(previous), false)
      return
    }

    this.animateCellTransition(current, previous, index)
  }

  private hintOne(): void {
    if (this.busy) return

    const index = this.state.cells.findIndex(
      (mask, cellIndex) => mask !== this.state.solution[cellIndex]
    )
    if (index < 0) return

    const previous = this.state
    this.assisted = true
    this.history.push(previous)

    const next: PipesState = {
      ...previous,
      moves: previous.moves + 1,
      cells: previous.cells.map((mask, cellIndex) =>
        cellIndex === index ? previous.solution[cellIndex]! : mask
      )
    }

    this.state = next
    this.say('已帮你接好一格，试试接下去')
    this.animateCellTransition(previous, next, index, () => {
      if (won(next)) this.complete()
    })
  }

  private animateCellTransition(
    previous: PipesState,
    next: PipesState,
    index: number,
    onComplete?: () => void
  ): void {
    const view = this.tileViews[index]
    if (!view) {
      this.syncConnectivity(connected(next), true)
      onComplete?.()
      return
    }

    const nextReached = connected(next)
    const quarterTurns = pipeQuarterTurnDelta(
      previous.cells[index]!,
      next.cells[index]!
    )

    this.busy = true
    const revision = this.viewRevision
    view.animateTo(
      next.cells[index]!,
      nextReached.has(index),
      quarterTurns,
      () => {
        if (revision !== this.viewRevision) return
        this.syncConnectivity(nextReached, true)
        this.busy = false
        onComplete?.()
      }
    )
  }

  private syncConnectivity(reached: Set<number>, pulse: boolean): void {
    this.tileViews.forEach((view, index) => {
      view.sync(this.state.cells[index]!, reached.has(index), pulse)
    })
  }

  private complete(): void {
    this.celebrate(
      this.assisted ? '提示练习完成啦！' : '独立接通啦！'
    )
    recordRun(
      `pipes-${this.size}`,
      this.state.moves,
      this.assisted
    )
  }

  private restart(): void {
    this.assisted = false
    this.state = newGame(this.size)
    this.history = []
    this.buildView()
  }

  private statusLine(): string {
    return `点管道旋转 · 从左上水源连通全部格子 · ${this.state.moves} 步`
  }
}
