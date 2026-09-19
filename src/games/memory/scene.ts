import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordBest } from '../puzzle-kit/progress'
import { PRODUCT_V3, preloadMemoryV3 } from '../../platform/display/product-v3-art'
import { conceal, flip, newGame } from './core/game'

export class MemoryScene extends PuzzleScene {
  private pairs = 12
  private players = 1
  private setB = false
  private state = newGame(12)
  private concealTimer?: Phaser.Time.TimerEvent

  constructor(audio: GameAudio, exit: () => void) {
    super('memory', '记忆翻牌', audio, exit)
  }

  preload(): void {
    preloadMemoryV3(this)
  }

  protected start(): void {
    this.draw()
  }

  private restart(): void {
    this.concealTimer?.remove()
    this.state = newGame(this.pairs, this.players)
    this.draw()
  }

  private draw(animatedIndex = -1): void {
    const s = this.state
    this.resetView(
      `${s.turns} 次尝试 · ${
        this.players === 2
          ? `轮到玩家 ${s.player + 1}　比分 ${s.scores.join(' : ')}`
          : `找到 ${s.matched.length / 2} / ${this.pairs} 对`
      }`
    )

    ;[12, 16, 24].forEach((pairs, i) => {
      this.button(
        170 + i * 214,
        165,
        `${pairs === this.pairs ? '✓ ' : ''}${pairs} 对`,
        () => {
          this.pairs = pairs
          this.restart()
        },
        190,
        this.content
      )
    })

    const cols = this.pairs === 12 ? 6 : 8
    const rows = s.cards.length / cols
    const cell = Math.min(148, 570 / cols, 450 / rows)
    const texture = this.setB ? PRODUCT_V3.memory.setB : PRODUCT_V3.memory.setA

    s.cards.forEach((value, index) => {
      const x = 384 + ((index % cols) - (cols - 1) / 2) * (cell + 12)
      const y = 490 + (Math.floor(index / cols) - (rows - 1) / 2) * (cell + 12)
      const shown = s.open.includes(index) || s.matched.includes(index)
      const matched = s.matched.includes(index)

      const tile = this.add.graphics({ x, y })
      tile.fillStyle(0x173f35, 0.13)
      tile.fillRoundedRect(-cell / 2, -cell / 2 + 5, cell, cell, 14)
      tile.fillStyle(matched ? 0xdcebdc : shown ? 0xfffff4 : 0x388573, 1)
      tile.fillRoundedRect(-cell / 2, -cell / 2, cell, cell - 4, 14)
      tile.lineStyle(2.2, shown ? 0xe7b45e : 0xffffff, shown ? 0.76 : 0.44)
      tile.strokeRoundedRect(-cell / 2 + 3, -cell / 2 + 3, cell - 6, cell - 10, 12)
      this.content.add(tile)

      let face: Phaser.GameObjects.Image | Phaser.GameObjects.Text
      if (shown && this.textures.exists(texture)) {
        const image = this.add.image(x, y - 1, texture, value % 24)
          .setDisplaySize(cell * 0.76, cell * 0.76)
        this.content.add(image)
        face = image
      } else {
        const back = this.add.text(x, y - 1, '✦', {
          fontFamily: 'Avenir Next, PingFang SC, sans-serif',
          fontSize: `${Math.max(22, cell * 0.38)}px`,
          color: '#dbeee5',
          fontStyle: 'bold'
        }).setOrigin(0.5)
        this.content.add(back)
        face = back
      }

      if (index === animatedIndex) {
        if (matched) {
          tile.setScale(1.18)
          face.setScale(1.18)
          this.tweens.add({
            targets: [tile, face],
            scale: 1,
            duration: 240,
            ease: 'Back.Out'
          })
        } else {
          tile.setScale(0.65, 1)
          face.setScale(0.65, 1)
          this.tweens.add({
            targets: [tile, face],
            scaleX: 1,
            duration: 140,
            ease: 'Cubic.Out'
          })
        }
      }

      tile
        .setInteractive(
          new Phaser.Geom.Rectangle(-cell / 2, -cell / 2, cell, cell),
          Phaser.Geom.Rectangle.Contains
        )
        .on('pointerup', () => {
          const next = flip(this.state, index)
          if (next === this.state) return

          const matchedBefore = this.state.matched.length
          this.state = next
          this.audio.playPlace(1)
          if (next.matched.length > matchedBefore) this.audio.playPop(1.25)
          this.draw(index)

          if (next.won) {
            this.celebrate(
              this.players === 2
                ? `完成！比分 ${next.scores.join(' : ')}`
                : `完成！用了 ${next.turns} 次`
            )
            recordBest(
              `memory-${this.pairs}:${this.players === 1 ? 'single' : 'duo'}`,
              next.turns
            )
          } else if (next.open.length === 2) {
            this.concealTimer = this.time.delayedCall(850, () => {
              this.state = conceal(this.state)
              this.draw()
            })
          }
        })
    })

    this.button(
      160,
      850,
      this.players === 1 ? '单人 → 双人' : '双人 → 单人',
      () => {
        this.players = this.players === 1 ? 2 : 1
        this.restart()
      },
      200,
      this.content
    )
    this.button(
      384,
      850,
      this.setB ? '换第一组' : '换第二组',
      () => {
        this.setB = !this.setB
        this.restart()
      },
      180,
      this.content
    )
    this.button(610, 850, '再玩一局', () => this.restart(), 180, this.content)
  }
}
