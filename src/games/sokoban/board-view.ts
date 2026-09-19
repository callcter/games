import Phaser from 'phaser'
import type { SokobanState } from './core/game'
import { sokobanVisualDelta } from './view-model'

export interface SokobanBoardGeometry {
  boardLeft: number
  boardTop: number
  cell: number
}

interface BoxView {
  container: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Arc
}

export class SokobanBoardView {
  private readonly boxViews: BoxView[] = []
  private readonly player: Phaser.GameObjects.Container

  constructor(
    private readonly scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    private readonly geometry: SokobanBoardGeometry,
    texture: string,
    state: SokobanState,
    onCellPress: (index: number) => void
  ) {
    for (let index = 0; index < state.width * state.height; index++) {
      const { x, y } = this.position(index, state.width)
      const wall = state.walls.includes(index)

      const tile = scene.add.rectangle(
        x,
        y,
        geometry.cell - 3,
        geometry.cell - 3,
        wall ? 0x527267 : 0xe9dfca
      )
      tile.setInteractive({ useHandCursor: true }).on('pointerup', () => onCellPress(index))
      parent.add(tile)

      if (wall && scene.textures.exists(texture)) {
        parent.add(
          scene.add.image(x, y, texture, 3)
            .setDisplaySize(geometry.cell * 0.92, geometry.cell * 0.92)
        )
      }

      if (state.goals.includes(index)) {
        if (scene.textures.exists(texture)) {
          parent.add(
            scene.add.image(x, y, texture, 2)
              .setDisplaySize(geometry.cell * 0.70, geometry.cell * 0.70)
              .setAlpha(0.92)
          )
        } else {
          parent.add(
            scene.add.circle(x, y, Math.min(15, geometry.cell * 0.22), 0xe6b84d)
          )
        }
      }
    }

    state.boxes.forEach((cellIndex, boxIndex) => {
      const { x, y } = this.position(cellIndex, state.width)
      const container = scene.add.container(x, y)
      const glow = scene.add.circle(
        0,
        0,
        geometry.cell * 0.38,
        0xf0c95c,
        0.22
      )
      glow.setStrokeStyle(2, 0xf0c95c, 0.58)

      let actor: Phaser.GameObjects.Image | Phaser.GameObjects.Text
      if (scene.textures.exists(texture)) {
        actor = scene.add.image(0, 0, texture, 1)
          .setDisplaySize(geometry.cell * 0.78, geometry.cell * 0.78)
      } else {
        actor = scene.add.text(0, 0, '📦', {
          fontFamily: 'Avenir Next, PingFang SC, sans-serif',
          fontSize: `${Math.min(44, geometry.cell * 0.6)}px`
        }).setOrigin(0.5)
      }

      container.add([glow, actor])
      parent.add(container)
      this.boxViews[boxIndex] = { container, glow }
    })

    const playerPosition = this.position(state.player, state.width)
    this.player = scene.add.container(playerPosition.x, playerPosition.y)

    let playerActor: Phaser.GameObjects.Image | Phaser.GameObjects.Text
    if (scene.textures.exists(texture)) {
      playerActor = scene.add.image(0, 0, texture, 0)
        .setDisplaySize(geometry.cell * 0.78, geometry.cell * 0.78)
    } else {
      playerActor = scene.add.text(0, 0, '🐱', {
        fontFamily: 'Avenir Next, PingFang SC, sans-serif',
        fontSize: `${Math.min(44, geometry.cell * 0.6)}px`
      }).setOrigin(0.5)
    }

    this.player.add(playerActor)
    parent.add(this.player)

    this.syncGoalState(state)
  }

  syncInstant(state: SokobanState): void {
    const player = this.position(state.player, state.width)
    this.player.setPosition(player.x, player.y)

    state.boxes.forEach((cellIndex, boxIndex) => {
      const view = this.boxViews[boxIndex]
      if (!view) return
      const point = this.position(cellIndex, state.width)
      view.container.setPosition(point.x, point.y)
    })

    this.syncGoalState(state)
  }

  animate(
    previous: SokobanState,
    next: SokobanState,
    onComplete: () => void
  ): void {
    const delta = sokobanVisualDelta(previous, next)
    const duration = 120
    let pending = 0

    const done = (): void => {
      pending -= 1
      if (pending > 0) return
      this.syncGoalState(next)
      onComplete()
    }

    const playerTarget = this.position(delta.playerTo, next.width)
    this.scene.tweens.killTweensOf(this.player)
    pending += 1
    this.scene.tweens.add({
      targets: this.player,
      x: playerTarget.x,
      y: playerTarget.y,
      duration,
      ease: 'Sine.Out',
      onComplete: done
    })

    if (delta.boxIndex >= 0) {
      const view = this.boxViews[delta.boxIndex]
      if (view) {
        const target = this.position(delta.boxTo, next.width)
        this.scene.tweens.killTweensOf(view.container)
        pending += 1
        this.scene.tweens.add({
          targets: view.container,
          x: target.x,
          y: target.y,
          duration,
          ease: 'Cubic.Out',
          onComplete: done
        })
      }
    }
  }

  private syncGoalState(state: SokobanState): void {
    this.boxViews.forEach((view, boxIndex) => {
      const onGoal = state.goals.includes(state.boxes[boxIndex]!)
      const wasVisible = view.glow.visible
      view.glow.setVisible(onGoal)

      if (onGoal && !wasVisible) {
        this.scene.tweens.killTweensOf(view.container)
        view.container.setScale(1)
        this.scene.tweens.add({
          targets: view.container,
          scale: 1.08,
          duration: 90,
          yoyo: true,
          ease: 'Sine.Out'
        })
      }
    })
  }

  private position(index: number, width: number): { x: number; y: number } {
    return {
      x: this.geometry.boardLeft +
        (index % width) * this.geometry.cell +
        this.geometry.cell / 2,
      y: this.geometry.boardTop +
        Math.floor(index / width) * this.geometry.cell +
        this.geometry.cell / 2
    }
  }
}
