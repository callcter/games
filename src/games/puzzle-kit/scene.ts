import Phaser from 'phaser'
import { GameAudio } from '../../platform/audio/game-audio'
import { flushDraft, loadDraft, saveDraft } from './draft-storage'
import { attachFirstRunHelp, showHelpPanel } from '../../ui/phaser/help'

export const INK = '#173f35'
export const COLORS = [0xe88065, 0x58a897, 0xe6b84d, 0x7e8dcd, 0xc47faf, 0x87b65e, 0x58b4d1]

export abstract class PuzzleScene extends Phaser.Scene {
  protected audio: GameAudio
  protected message = ''
  protected heading: string
  protected exit: () => void
  protected content!: Phaser.GameObjects.Container
  private status!: Phaser.GameObjects.Text
  protected alive = false
  private draftId?: string
  /** 首次进入自动弹玩法说明；动作游戏有自己的开场说明，覆写为 false。 */
  protected showFirstRunHelp = true

  constructor(key: string, title: string, audio: GameAudio, exit: () => void) {
    super(key)
    this.heading = title
    this.audio = audio
    this.exit = exit
  }

  create(): void {
    this.alive = true
    const flush = (): void => { if (this.draftId) flushDraft(this.draftId) }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    const cleanup = (): void => {
      this.alive = false
      flush(); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush)
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup)
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanup)
    }
    // Scene.stop 发 SHUTDOWN，Game.destroy 直接发 DESTROY；两条离开路径都必须释放外部资源。
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
    this.cameras.main.setBackgroundColor('#f8f1df')
    this.input.on('pointerdown', () => void this.audio.unlock())
    this.input.keyboard?.on('keydown', () => void this.audio.unlock())
    const header = this.add.graphics()
    header.fillStyle(0xfffdf6, 0.96)
    header.fillRoundedRect(16, 12, 736, 116, 24)
    header.setDepth(-1)
    this.button(90, 45, '‹ 游戏屋', this.exit, 132)
    this.text(384, 45, this.heading, 34)
    this.button(560, 45, '?', () => { showHelpPanel(this, this.heading) }, 52)
    const sound = this.button(680, 45, this.audio.isMuted ? '声音关' : '声音开', () => {
      this.audio.toggleMuted()
      sound.setText(this.audio.isMuted ? '声音关' : '声音开')
    }, 124)
    this.status = this.text(384, 103, '', 19)
    this.content = this.add.container(0, 0)
    if (this.showFirstRunHelp) attachFirstRunHelp(this, this.heading)
    this.start()
  }

  protected abstract start(): void

  protected async offerResume<T extends { state: { won: boolean } }>(id: string, restore: (value: unknown) => T | null, resume: (saved: T) => void, fresh: (saved?: T) => void): Promise<void> {
    this.draftId = id
    this.resetView('正在读取进度…')
    const saved = await loadDraft(id, restore)
    if (!this.alive) return
    if (!saved || saved.state.won) { fresh(); return }
    this.resetView('找到上次还没完成的一局')
    this.text(384, 360, '继续上次的挑战吗？', 30, this.content)
    this.button(260, 480, '继续上次', () => resume(saved), 200, this.content)
    this.button(510, 480, '重新开始', () => { saveDraft(id, null); fresh(saved) }, 200, this.content)
  }

  protected remember(id: string, value: unknown): void { this.draftId = id; saveDraft(id, value) }

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
    const selected = label.startsWith('✓')
    const primary = /^(开\s*始|继续上次|再来一次)/.test(label)
    const filled = selected || primary
    const background = this.add.graphics({ x, y })
    const paint = (down = false): void => {
      background.clear()
      background.fillStyle(0x173f35, 0.10)
      background.fillRoundedRect(-width / 2, -27, width, 60, 16)
      background.fillStyle(down ? 0xd7e9df : filled ? 0x2f7865 : 0xfffdf6)
      background.fillRoundedRect(-width / 2, -30, width, 60, 16)
      background.lineStyle(1.5, filled ? 0x2f7865 : 0xd8dfd4)
      background.strokeRoundedRect(-width / 2, -30, width, 60, 16)
    }
    paint()
    parent?.add(background)
    const text = this.text(x, y, label, 21, parent)
    if (filled) text.setColor('#fffdf6')
    let pressed = false
    background.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -30, width, 60), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => { pressed = true; paint(true); text.setColor(INK) })
      .on('pointerout', () => { pressed = false; paint(); text.setColor(filled ? '#fffdf6' : INK) })
      .on('pointerup', () => { if (pressed) { pressed = false; paint(); text.setColor(filled ? '#fffdf6' : INK); action() } })
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
