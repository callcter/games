import Phaser from 'phaser'
import { GameAudio } from '../../platform/audio/game-audio'
import { flushDraft, loadDraft, saveDraft } from './draft-storage'
import { attachFirstRunHelp, showHelpPanel } from '../../ui/phaser/help'
import { createPuzzleChrome, GAME_UI, type PuzzleChrome } from '../../ui'
import { legacyVerticalOffset, measurePlayArea, type PlayAreaMetrics, type PlayAreaOptions } from './play-area'

export const INK = '#173f35'
export const COLORS = [0xe88065, 0x58a897, 0xe6b84d, 0x7e8dcd, 0xc47faf, 0x87b65e, 0x58b4d1]

export abstract class PuzzleScene extends Phaser.Scene {
  protected audio: GameAudio
  protected message = ''
  protected heading: string
  protected exit: () => void
  protected content!: Phaser.GameObjects.Container
  protected alive = false

  /** 旧 768×900 游戏内容在高屏手机中的纵向平移。 */
  protected contentOffsetY = 0

  /**
   * v5 开始逐游戏迁移到真正的动态内容区。
   * 默认 false：尚未迁移的 Puzzle/Action 完全保持 v4 行为。
   */
  protected useResponsivePlayArea = false

  private draftId?: string
  private shellBackdrop!: Phaser.GameObjects.Graphics
  private chrome!: PuzzleChrome
  private readonly shellResize = (): void => this.layoutShell()
  private playLayoutReady = false

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
      flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
      this.scale.off('resize', this.shellResize)
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup)
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanup)
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)

    this.cameras.main.setBackgroundColor('#f8f1df')
    this.input.on('pointerdown', () => void this.audio.unlock())
    this.input.keyboard?.on('keydown', () => void this.audio.unlock())

    this.shellBackdrop = this.add.graphics().setDepth(-1000)
    this.content = this.add.container(0, 0)

    this.chrome = createPuzzleChrome(this, {
      title: this.heading,
      compactContent: true,
      audio: this.audio,
      onBack: this.exit,
      onHelp: () => showHelpPanel(this, this.heading)
    })

    this.layoutShell()
    this.scale.on('resize', this.shellResize)

    if (this.showFirstRunHelp) attachFirstRunHelp(this, this.heading)
    this.start()
    this.playLayoutReady = true
  }

  protected abstract start(): void

  protected playArea(options?: PlayAreaOptions): PlayAreaMetrics {
    return measurePlayArea(768, this.scale.height, options)
  }

  /**
   * 只给 opt-in 的响应式游戏使用。
   * 横竖屏切换时重排 View；state/core 不应在这里变化。
   */
  protected onPlayAreaResize(): void {
    // subclasses opt in
  }

  /**
   * 将 Scene 级 Pointer 坐标转换回旧 768×900 内容坐标。
   * 只有手写 pointer.x/y 命中逻辑需要它；Phaser 自带 interactive/drag
   * 会自动处理 Container transform。
   */
  protected legacyPoint(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(pointer.x, pointer.y - this.contentOffsetY)
  }

  protected legacyY(sceneY: number): number {
    return sceneY - this.contentOffsetY
  }

  private layoutShell(): void {
    const width = 768
    const height = this.scale.height

    // v4 游戏继续保持 legacy 900 内容坐标；
    // v5 opt-in 游戏直接拿到完整动态逻辑高度。
    this.contentOffsetY = this.useResponsivePlayArea
      ? 0
      : Phaser.Math.Clamp(
          Math.round((height - 900) * 0.47),
          0,
          360
        )
    this.content?.setPosition(0, this.contentOffsetY)
    this.chrome?.layout(width, height)

    if (!this.shellBackdrop) return
    this.shellBackdrop.clear()
    this.shellBackdrop.fillStyle(0xf8f1df, 1)
    this.shellBackdrop.fillRect(0, 0, width, height)

    // 不是“空白填色”：用非常轻的玩具屋纸张层次把长屏留白变成有意图的舞台。
    this.shellBackdrop.fillStyle(0xffffff, 0.24)
    this.shellBackdrop.fillCircle(72, 172, 170)
    this.shellBackdrop.fillStyle(GAME_UI.colors.sage, 0.11)
    this.shellBackdrop.fillCircle(742, Math.max(690, height * 0.67), 240)
    this.shellBackdrop.fillStyle(GAME_UI.colors.honey, 0.10)
    this.shellBackdrop.fillCircle(40, height - 52, 210)

    const responsivePhone = this.useResponsivePlayArea && this.playArea().phoneLike
    const stageY = responsivePhone
      ? 188
      : (this.useResponsivePlayArea ? legacyVerticalOffset(height) : this.contentOffsetY) + 150
    const stageH = responsivePhone
      ? Math.max(700, height - stageY - 34)
      : 700
    this.shellBackdrop.fillStyle(0xfffff4, 0.20)
    this.shellBackdrop.fillRoundedRect(28, stageY, 712, stageH, 44)
    this.shellBackdrop.lineStyle(2, GAME_UI.colors.honey, 0.10)
    this.shellBackdrop.strokeRoundedRect(30, stageY + 2, 708, stageH - 4, 42)

    if (this.playLayoutReady && this.useResponsivePlayArea) {
      this.onPlayAreaResize()
    }
  }

  protected async offerResume<T extends { state: { won: boolean } }>(
    id: string,
    restore: (value: unknown) => T | null,
    resume: (saved: T) => void,
    fresh: (saved?: T) => void
  ): Promise<void> {
    this.draftId = id
    this.resetView('正在读取进度…')
    const saved = await loadDraft(id, restore)
    if (!this.alive) return
    if (!saved || saved.state.won) {
      fresh()
      return
    }

    this.resetView('找到上次还没完成的一局')
    this.text(384, 360, '继续上次的挑战吗？', 30, this.content)
    this.button(260, 480, '继续上次', () => resume(saved), 200, this.content)
    this.button(
      510,
      480,
      '重新开始',
      () => {
        saveDraft(id, null)
        fresh(saved)
      },
      200,
      this.content
    )
  }

  protected remember(id: string, value: unknown): void {
    this.draftId = id
    saveDraft(id, value)
  }

  protected resetView(message: string): void {
    this.message = message
    this.chrome.setStatus(message)
    this.content.removeAll(true)
  }

  protected say(message: string): void {
    this.message = message
    this.chrome.setStatus(message)
  }

  protected text(
    x: number,
    y: number,
    value: string,
    size = 24,
    parent?: Phaser.GameObjects.Container
  ): Phaser.GameObjects.Text {
    const result = this.add.text(x, y, value, {
      fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: `${size}px`,
      color: INK,
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    parent?.add(result)
    return result
  }

  /**
   * Legacy 内容按钮兼容层。
   * 应用级返回/声音/帮助已迁到 src/ui；游戏自己的“撤销/换一局/继续”等
   * 可以逐步迁移，不要求在 v4 一次重写 14 个玩法文件。
   */
  protected button(
    x: number,
    y: number,
    label: string,
    action: () => void,
    width = 140,
    parent?: Phaser.GameObjects.Container
  ): Phaser.GameObjects.Text {
    const selected = label.startsWith('✓')
    const primary = /^(开\s*始|继续上次|再来一次)/.test(label)
    const filled = selected || primary
    const background = this.add.graphics({ x, y })

    const paint = (down = false): void => {
      background.clear()
      background.fillStyle(GAME_UI.colors.cocoa, 0.15)
      background.fillRoundedRect(-width / 2, -27, width, 60, 18)
      background.fillStyle(
        down
          ? 0xf0e4c3
          : filled
            ? GAME_UI.colors.forest
            : GAME_UI.colors.creamLight
      )
      background.fillRoundedRect(-width / 2, -30, width, 60, 18)
      background.lineStyle(
        2,
        filled ? GAME_UI.colors.forest : GAME_UI.colors.honey,
        filled ? 0.72 : 0.52
      )
      background.strokeRoundedRect(-width / 2 + 1, -29, width - 2, 58, 17)
    }

    paint()
    parent?.add(background)

    const text = this.text(x, y, label, 21, parent)
    if (filled) text.setColor('#fffdf6')

    let pressed = false
    background
      .setInteractive(
        new Phaser.Geom.Rectangle(-width / 2, -30, width, 60),
        Phaser.Geom.Rectangle.Contains
      )
      .on('pointerdown', () => {
        pressed = true
        paint(true)
        text.setColor(INK)
      })
      .on('pointerout', () => {
        pressed = false
        paint()
        text.setColor(filled ? '#fffdf6' : INK)
      })
      .on('pointerup', () => {
        if (!pressed) return
        pressed = false
        paint()
        text.setColor(filled ? '#fffdf6' : INK)
        action()
      })

    return text
  }

  protected celebrate(label = '完成啦！'): void {
    this.say(label)
    this.audio.playWin()
    const area = this.useResponsivePlayArea ? this.playArea({ bottom: 120 }) : null
    const badgeY = area?.phoneLike
      ? area.bottom - 150
      : 780 + (this.useResponsivePlayArea ? legacyVerticalOffset(this.scale.height) : 0)
    const badge = this.text(384, badgeY, '✦ 太棒啦 ✦', 30, this.content)
    badge.setScale(0.7)
    this.tweens.add({
      targets: badge,
      scale: 1,
      duration: 250,
      ease: 'Back.Out'
    })
  }
}
