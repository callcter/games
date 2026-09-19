import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PRODUCT_V3_BATCH2, preloadMazeBatch2 } from '../../platform/display/product-v3-batch2-art'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordRun } from '../puzzle-kit/progress'
import { DIRECTIONS, neighbor } from '../pipes/core/game'
import {
  dragAlong,
  move,
  newGame,
  path,
  undo,
  type MazeState
} from './core/game'
import { mazeLayout } from './layout'

export class MazeScene extends PuzzleScene {
  protected override useResponsivePlayArea = true

  private size = 7
  private state = newGame(7)
  private hint = -1
  private assisted = false
  private shortest = path(this.state).length - 1
  private dragPoint: { x: number; y: number } | null = null
  private rabbit!: Phaser.GameObjects.Image | Phaser.GameObjects.Text
  private hintMarker?: Phaser.GameObjects.Image
  private tiles: Phaser.GameObjects.Rectangle[] = []

  constructor(audio: GameAudio, exit: () => void) {
    super('maze', '迷宫探险', audio, exit)
  }

  preload(): void {
    preloadMazeBatch2(this)
  }

  protected start(): void {
    const gridPoint = (pointer: Phaser.Input.Pointer) => {
      const point = this.legacyPoint(pointer)
      const layout = this.currentLayout()
      return {
        x: (point.x - layout.boardLeft) / layout.cell,
        y: (point.y - layout.boardTop) / layout.cell
      }
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragPoint = null
      const point = gridPoint(pointer)

      if (
        point.x < 0 ||
        point.y < 0 ||
        point.x >= this.size ||
        point.y >= this.size ||
        this.state.won
      ) return

      const target =
        Math.floor(point.y) * this.size +
        Math.floor(point.x)

      const direction = [0, 1, 2, 3].find(
        candidate =>
          neighbor(
            this.state.player,
            candidate,
            this.size
          ) === target
      )

      if (direction !== undefined) this.step(direction)
      if (this.state.player === target) this.dragPoint = point
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.dragPoint) return

      const point = gridPoint(pointer)
      const from = this.dragPoint

      if (
        point.x < 0 ||
        point.y < 0 ||
        point.x >= this.size ||
        point.y >= this.size
      ) {
        this.dragPoint = null
        return
      }

      this.applyMove(
        dragAlong(
          this.state,
          from.x,
          from.y,
          point.x,
          point.y
        )
      )
      this.dragPoint = point
    })

    for (const event of [
      'pointerup',
      'pointerupoutside',
      'gameout'
    ]) {
      this.input.on(event, () => {
        this.dragPoint = null
      })
    }

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

    this.buildView()
  }

  protected override onPlayAreaResize(): void {
    this.buildView()
  }

  private currentLayout() {
    return mazeLayout(
      this.playArea({
        bottom: 78,
        horizontalPadding: 42
      }),
      this.size
    )
  }

  private step(direction: number): void {
    this.applyMove(move(this.state, direction))
  }

  private applyMove(next: MazeState): void {
    if (next === this.state) return

    this.state = next
    this.hint = -1
    this.audio.playMove()
    this.refreshVisuals(true)

    if (next.won) {
      this.celebrate(
        this.assisted
          ? '提示练习：小兔子到家啦！'
          : '小兔子独立到家啦！'
      )
      recordRun(
        `maze-${this.size}`,
        Math.max(
          0,
          next.trail.length - this.shortest
        ),
        this.assisted
      )
    }
  }

  private buildView(): void {
    this.dragPoint = null
    this.tiles = []
    this.hintMarker = undefined
    if (this.rabbit) this.tweens.killTweensOf(this.rabbit)

    const layout = this.currentLayout()

    this.resetView('')

    ;[7, 9, 11].forEach((size, index) => {
      this.button(
        160 + 224 * index,
        layout.modeY,
        `${this.size === size ? '✓ ' : ''}${size} × ${size}`,
        () => {
          this.size = size
          this.restart()
        },
        190,
        this.content
      )
    })

    this.state.passages.forEach((mask, index) => {
      const x = layout.boardLeft +
        (index % this.size) * layout.cell
      const y = layout.boardTop +
        Math.floor(index / this.size) * layout.cell

      const tile = this.add.rectangle(
        x + layout.cell / 2,
        y + layout.cell / 2,
        layout.cell,
        layout.cell,
        0xfffdf6
      )
      this.content.add(tile)
      this.tiles.push(tile)

      const walls = this.add.graphics()
      walls.lineStyle(4, 0x527267)

      if (!(mask & DIRECTIONS[0])) {
        walls.lineBetween(
          x,
          y,
          x + layout.cell,
          y
        )
      }
      if (!(mask & DIRECTIONS[1])) {
        walls.lineBetween(
          x + layout.cell,
          y,
          x + layout.cell,
          y + layout.cell
        )
      }
      if (!(mask & DIRECTIONS[2])) {
        walls.lineBetween(
          x,
          y + layout.cell,
          x + layout.cell,
          y + layout.cell
        )
      }
      if (!(mask & DIRECTIONS[3])) {
        walls.lineBetween(
          x,
          y,
          x,
          y + layout.cell
        )
      }

      this.content.add(walls)

      if (index === this.size * this.size - 1) {
        if (
          this.textures.exists(
            PRODUCT_V3_BATCH2.maze.sprites
          )
        ) {
          this.content.add(
            this.add.image(
              x + layout.cell / 2,
              y + layout.cell / 2,
              PRODUCT_V3_BATCH2.maze.sprites,
              1
            ).setDisplaySize(
              layout.cell * 0.70,
              layout.cell * 0.70
            )
          )
        } else {
          this.text(
            x + layout.cell / 2,
            y + layout.cell / 2,
            '🏠',
            layout.cell * 0.58,
            this.content
          )
        }
      }
    })

    if (
      this.textures.exists(
        PRODUCT_V3_BATCH2.maze.sprites
      )
    ) {
      this.hintMarker = this.add.image(
        0,
        0,
        PRODUCT_V3_BATCH2.maze.sprites,
        2
      )
        .setDisplaySize(
          layout.cell * 0.48,
          layout.cell * 0.48
        )
        .setAlpha(0.82)
        .setVisible(false)
      this.content.add(this.hintMarker)

      this.rabbit = this.add.image(
        0,
        0,
        PRODUCT_V3_BATCH2.maze.sprites,
        0
      ).setDisplaySize(
        layout.cell * 0.70,
        layout.cell * 0.70
      )
      this.content.add(this.rabbit)
    } else {
      this.rabbit = this.text(
        0,
        0,
        '🐰',
        layout.cell * 0.58,
        this.content
      )
    }

    ;['↑', '→', '↓', '←'].forEach((label, direction) => {
      this.button(
        222 + direction * 108,
        layout.directionY,
        label,
        () => this.step(direction),
        96,
        this.content
      )
    })

    this.button(
      160,
      layout.footerY,
      '撤销',
      () => this.undoMove(),
      180,
      this.content
    )

    this.button(
      384,
      layout.footerY,
      '提示一步',
      () => this.showHint(),
      180,
      this.content
    )

    this.button(
      608,
      layout.footerY,
      '新迷宫',
      () => this.restart(),
      180,
      this.content
    )

    this.refreshVisuals(false)
  }

  private undoMove(): void {
    const next = undo(this.state)
    if (next === this.state) return

    this.state = next
    this.hint = -1
    this.audio.playMove()
    this.refreshVisuals(true)
  }

  private showHint(): void {
    this.assisted = true
    this.hint = path(this.state)[1] ?? -1
    this.refreshVisuals(false)
  }

  private refreshVisuals(animateRabbit: boolean): void {
    const layout = this.currentLayout()
    const rabbitX =
      layout.boardLeft +
      (this.state.player % this.size + 0.5) *
        layout.cell
    const rabbitY =
      layout.boardTop +
      (Math.floor(this.state.player / this.size) + 0.5) *
        layout.cell

    this.tweens.killTweensOf(this.rabbit)

    if (animateRabbit) {
      this.tweens.add({
        targets: this.rabbit,
        x: rabbitX,
        y: rabbitY,
        duration: 90,
        ease: 'Sine.Out'
      })
    } else {
      this.rabbit.setPosition(rabbitX, rabbitY)
    }

    this.tiles.forEach((tile, index) => {
      tile.setFillStyle(
        index === this.hint
          ? 0xffd982
          : this.state.trail.includes(index)
            ? 0xe0eddf
            : 0xfffdf6
      )
    })

    if (this.hintMarker) {
      if (this.hint >= 0) {
        const hintX =
          layout.boardLeft +
          (this.hint % this.size + 0.5) *
            layout.cell
        const hintY =
          layout.boardTop +
          (Math.floor(this.hint / this.size) + 0.5) *
            layout.cell

        this.hintMarker
          .setPosition(hintX, hintY)
          .setVisible(true)
      } else {
        this.hintMarker.setVisible(false)
      }
    }

    this.say(
      `按住小兔子沿路拖动，也能点相邻格 · ${
        this.state.trail.length
      } 步`
    )
  }

  private restart(): void {
    this.assisted = false
    this.state = newGame(this.size)
    this.shortest = path(this.state).length - 1
    this.hint = -1
    this.buildView()
  }
}
