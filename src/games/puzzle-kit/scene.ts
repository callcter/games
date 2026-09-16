import Phaser from 'phaser'
import { GameAudio } from '../../platform/audio/game-audio'

export const INK = '#173f35'
export const COLORS = [0xe88065, 0x58a897, 0xe6b84d, 0x7e8dcd, 0xc47faf, 0x87b65e, 0x58b4d1]

export abstract class PuzzleScene extends Phaser.Scene {
  protected audio: GameAudio
  protected message = ''
  protected heading: string
  private exit: () => void
  protected content!: Phaser.GameObjects.Container
  private status!: Phaser.GameObjects.Text
  protected alive = false

  constructor(key: string, title: string, audio: GameAudio, exit: () => void) {
    super(key)
    this.heading = title
    this.audio = audio
    this.exit = exit
  }

  create(): void {
    this.alive = true
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.alive = false })
    this.cameras.main.setBackgroundColor('#f8f1df')
    this.input.on('pointerdown', () => void this.audio.unlock())
    this.input.keyboard?.on('keydown', () => void this.audio.unlock())
    this.button(90, 45, '‹ 游戏屋', this.exit, 132)
    this.text(384, 45, this.heading, 34)
    const sound = this.button(680, 45, this.audio.isMuted ? '声音关' : '声音开', () => {
      this.audio.toggleMuted()
      sound.setText(this.audio.isMuted ? '声音关' : '声音开')
    }, 124)
    this.status = this.text(384, 103, '', 19)
    this.content = this.add.container(0, 0)
    this.start()
  }

  protected abstract start(): void

  protected resetView(message: string): void {
    this.message = message
    this.status.setText(message)
    this.content.removeAll(true)
  }

  protected say(message: string): void { this.message = message; this.status.setText(message) }

  protected text(x: number, y: number, value: string, size = 24, parent?: Phaser.GameObjects.Container): Phaser.GameObjects.Text {
    const result = this.add.text(x, y, value, { fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: `${size}px`, color: INK, align: 'center', fontStyle: 'bold' }).setOrigin(0.5)
    parent?.add(result)
    return result
  }

  protected button(x: number, y: number, label: string, action: () => void, width = 140, parent?: Phaser.GameObjects.Container): Phaser.GameObjects.Text {
    const background = this.add.rectangle(x, y, width, 60, 0xfffdf6).setStrokeStyle(2, 0xd8cdbb)
    parent?.add(background)
    const text = this.text(x, y, label, 21, parent)
    background.setInteractive({ useHandCursor: true }).on('pointerup', action)
    return text
  }

  protected celebrate(label = '完成啦！'): void {
    this.say(label)
    this.audio.playWin()
    const badge = this.text(384, 780, '✦ 太棒啦 ✦', 30, this.content)
    badge.setScale(0.7)
    this.tweens.add({ targets: badge, scale: 1, duration: 250, ease: 'Back.Out' })
  }
}
