import Phaser from 'phaser'

export type MemoryCardMotion = 'none' | 'flip' | 'match'

export class MemoryCardView {
  readonly container: Phaser.GameObjects.Container

  private readonly tile: Phaser.GameObjects.Graphics
  private readonly face: Phaser.GameObjects.Image | Phaser.GameObjects.Text
  private readonly back: Phaser.GameObjects.Text
  private shown = false

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly cell: number,
    texture: string,
    frame: number,
    onPress: () => void
  ) {
    this.container = scene.add.container(x, y)
    this.tile = scene.add.graphics()

    if (scene.textures.exists(texture)) {
      this.face = scene.add.image(0, -1, texture, frame)
        .setDisplaySize(cell * 0.76, cell * 0.76)
    } else {
      this.face = scene.add.text(0, -1, String(frame + 1), {
        fontFamily: 'Avenir Next, PingFang SC, sans-serif',
        fontSize: `${Math.max(22, cell * 0.32)}px`,
        color: '#173f35',
        fontStyle: 'bold'
      }).setOrigin(0.5)
    }

    this.back = scene.add.text(0, -1, '✦', {
      fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: `${Math.max(22, cell * 0.38)}px`,
      color: '#dbeee5',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const hit = scene.add.zone(0, 0, cell, cell)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', onPress)

    this.container.add([this.tile, this.face, this.back, hit])
    this.applyState(false, false)
  }

  sync(shown: boolean, matched: boolean, motion: MemoryCardMotion = 'none'): void {
    if (motion === 'flip' && shown !== this.shown) {
      this.flipTo(shown, matched)
      return
    }

    this.applyState(shown, matched)
    if (motion === 'match') this.bounce()
  }

  private flipTo(shown: boolean, matched: boolean): void {
    this.scene.tweens.killTweensOf(this.container)
    this.container.setScale(1)

    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.06,
      duration: 85,
      ease: 'Sine.In',
      onComplete: () => {
        this.applyState(shown, matched)
        this.scene.tweens.add({
          targets: this.container,
          scaleX: 1,
          duration: 105,
          ease: 'Back.Out',
          onComplete: () => {
            if (matched) this.bounce()
          }
        })
      }
    })
  }

  private bounce(): void {
    this.scene.tweens.killTweensOf(this.container)
    this.container.setScale(1)
    this.scene.tweens.add({
      targets: this.container,
      scale: 1.10,
      duration: 105,
      yoyo: true,
      ease: 'Sine.Out'
    })
  }

  private applyState(shown: boolean, matched: boolean): void {
    this.shown = shown

    this.tile.clear()
    this.tile.fillStyle(0x173f35, 0.13)
    this.tile.fillRoundedRect(
      -this.cell / 2,
      -this.cell / 2 + 5,
      this.cell,
      this.cell,
      14
    )
    this.tile.fillStyle(
      matched ? 0xdcebdc : shown ? 0xfffff4 : 0x388573,
      1
    )
    this.tile.fillRoundedRect(
      -this.cell / 2,
      -this.cell / 2,
      this.cell,
      this.cell - 4,
      14
    )
    this.tile.lineStyle(
      2.2,
      shown ? 0xe7b45e : 0xffffff,
      shown ? 0.76 : 0.44
    )
    this.tile.strokeRoundedRect(
      -this.cell / 2 + 3,
      -this.cell / 2 + 3,
      this.cell - 6,
      this.cell - 10,
      12
    )

    this.face.setVisible(shown)
    this.back.setVisible(!shown)
    this.container.setAlpha(matched ? 0.96 : 1)
  }
}
