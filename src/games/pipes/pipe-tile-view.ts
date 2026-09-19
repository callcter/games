import Phaser from 'phaser'
import { DIRECTIONS } from './core/game'

export class PipeTileView {
  readonly container: Phaser.GameObjects.Container

  private readonly base: Phaser.GameObjects.Graphics
  private readonly pipeRoot: Phaser.GameObjects.Container
  private readonly pipe: Phaser.GameObjects.Graphics
  private readonly source: Phaser.GameObjects.Graphics
  private mask = 0
  private reached = false

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly cell: number,
    sourceTile: boolean,
    onPress: () => void
  ) {
    this.container = scene.add.container(x, y)
    this.base = scene.add.graphics()
    this.pipeRoot = scene.add.container(0, 0)
    this.pipe = scene.add.graphics()
    this.pipeRoot.add(this.pipe)

    this.source = scene.add.graphics()
    if (sourceTile) this.paintSource()
    else this.source.setVisible(false)

    const hit = scene.add.zone(0, 0, cell - 5, cell - 5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', onPress)

    this.container.add([this.base, this.pipeRoot, this.source, hit])
  }

  sync(mask: number, reached: boolean, pulse = false): void {
    const gained = !this.reached && reached
    this.mask = mask
    this.reached = reached
    this.paint()

    if (pulse && gained) {
      this.scene.tweens.killTweensOf(this.pipeRoot)
      this.pipeRoot.setScale(0.88)
      this.scene.tweens.add({
        targets: this.pipeRoot,
        scale: 1,
        duration: 180,
        ease: 'Back.Out'
      })
    }
  }

  animateTo(
    mask: number,
    reached: boolean,
    quarterTurns: -1 | 0 | 1 | 2,
    onComplete: () => void
  ): void {
    if (quarterTurns === 0) {
      this.sync(mask, reached)
      onComplete()
      return
    }

    this.scene.tweens.killTweensOf(this.pipeRoot)
    this.pipeRoot.setAngle(0)

    this.scene.tweens.add({
      targets: this.pipeRoot,
      angle: quarterTurns * 90,
      duration: quarterTurns === 2 ? 190 : 135,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.pipeRoot.setAngle(0)
        this.sync(mask, reached)
        onComplete()
      }
    })
  }

  private paint(): void {
    const half = this.cell / 2
    const radius = Math.max(12, this.cell * 0.12)

    this.base.clear()
    this.base.fillStyle(0x684a34, 0.10)
    this.base.fillRoundedRect(
      -half + 4,
      -half + 8,
      this.cell - 8,
      this.cell - 8,
      radius
    )
    this.base.fillStyle(this.reached ? 0xe8f4ee : 0xfff8e7, 0.98)
    this.base.fillRoundedRect(
      -half + 4,
      -half + 3,
      this.cell - 8,
      this.cell - 10,
      radius
    )
    this.base.lineStyle(2, this.reached ? 0x91c7b8 : 0xd8cdbb, 0.70)
    this.base.strokeRoundedRect(
      -half + 5,
      -half + 4,
      this.cell - 10,
      this.cell - 12,
      Math.max(11, this.cell * 0.11)
    )

    this.pipe.clear()
    this.pipe.lineStyle(this.cell * 0.22, 0x684a34, 0.12)
    DIRECTIONS.forEach((bit, direction) => {
      if (!(this.mask & bit)) return
      this.pipe.lineBetween(
        2,
        4,
        [0, 1, 0, -1][direction]! * half + 2,
        [-1, 0, 1, 0][direction]! * half + 4
      )
    })

    const color = this.reached ? 0x4fa68e : 0x778779
    this.pipe.lineStyle(this.cell * 0.17, color)
    DIRECTIONS.forEach((bit, direction) => {
      if (!(this.mask & bit)) return
      this.pipe.lineBetween(
        0,
        0,
        [0, 1, 0, -1][direction]! * half,
        [-1, 0, 1, 0][direction]! * half
      )
    })
    this.pipe.fillStyle(color)
    this.pipe.fillCircle(0, 0, this.cell * 0.13)

    this.pipe.lineStyle(
      this.cell * 0.045,
      this.reached ? 0xc8f1e6 : 0xd5ddd7
    )
    DIRECTIONS.forEach((bit, direction) => {
      if (!(this.mask & bit)) return
      this.pipe.lineBetween(
        0,
        0,
        [0, 1, 0, -1][direction]! * half,
        [-1, 0, 1, 0][direction]! * half
      )
    })
  }

  private paintSource(): void {
    this.source.fillStyle(0xffffff, 0.92)
    this.source.fillCircle(0, 0, this.cell * 0.20)
    this.source.lineStyle(2, 0x66bfe3, 0.78)
    this.source.strokeCircle(0, 0, this.cell * 0.20)
    this.source.fillStyle(0x66bfe3, 1)
    this.source.fillCircle(0, this.cell * 0.035, this.cell * 0.075)
    this.source.fillTriangle(
      0,
      -this.cell * 0.10,
      -this.cell * 0.065,
      this.cell * 0.02,
      this.cell * 0.065,
      this.cell * 0.02
    )
  }
}
