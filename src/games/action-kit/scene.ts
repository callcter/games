import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { awardLeaf } from '../../app/tree'
import {
  createToolButton,
  showGameDialog,
  type GameDialog
} from '../../ui'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordBest } from '../puzzle-kit/progress'

// 仍沿用 768×900 内容坐标；PuzzleScene 会在高屏手机整体平移内容。
// 玩法 core 不需要知道手机真实屏幕高度。
export const FIELD = { top: 228, bottom: 845 } as const

export abstract class ActionScene extends PuzzleScene {
  protected entities!: Phaser.GameObjects.Container
  protected running = false
  protected mode = 0

  private remainingMs = 0
  private best = 0
  private readonly bestKey: string
  private readonly gameId: string
  private roundInputs: Array<() => void> = []
  private bursts = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>()
  private resultDialog?: GameDialog

  protected override readonly showFirstRunHelp = false

  protected onRoundInput(
    event: string,
    handler: (pointer: Phaser.Input.Pointer) => void
  ): void {
    this.input.on(event, handler)
    this.roundInputs.push(() => this.input.off(event, handler))
  }

  protected override resetView(message: string): void {
    this.resultDialog?.close()
    this.resultDialog = undefined
    this.roundInputs.splice(0).forEach(remove => remove())
    this.bursts.clear()
    this.tweens.killAll()
    super.resetView(message)
  }

  constructor(key: string, title: string, audio: GameAudio, exit: () => void) {
    super(key, title, audio, exit)
    this.gameId = key
    this.bestKey = `family-game-room-${key}-v2-best`
  }

  private readBest(mode: number): number {
    try {
      const value = Number(window.localStorage.getItem(`${this.bestKey}-${mode}`))
      return Number.isFinite(value) && value >= 0 ? value : 0
    } catch {
      return 0
    }
  }

  protected abstract modes(): readonly { label: string }[]
  protected abstract startRound(mode: number): void
  protected abstract tick(delta: number): void
  protected abstract statusLine(): string
  protected abstract roundScore(): number
  protected abstract headline(): string
  protected abstract roundSeconds(mode: number): number

  protected start(): void {
    this.showIntro()
  }

  update(_time: number, delta: number): void {
    if (!this.running) return
    const clamped = Math.min(delta, 50)
    this.remainingMs -= clamped
    this.tick(clamped)
    this.showHud()
    if (this.remainingMs <= 0) this.endRound()
  }

  protected showHud(): void {
    this.say(this.statusLine())
  }

  protected get remainingSeconds(): number {
    return Math.max(0, Math.ceil(this.remainingMs / 100) / 10)
  }

  protected addTime(deltaMs: number): void {
    this.remainingMs = Math.max(0, this.remainingMs + deltaMs)
  }

  protected showIntro(): void {
    this.running = false
    this.best = Math.max(...[0, 1, 2].map(mode => this.readBest(mode)))
    this.resetView('选一个节奏，马上开玩')

    const panel = this.add.graphics()
    panel.fillStyle(0x684a34, 0.13)
    panel.fillRoundedRect(40, 222, 688, 350, 34)
    panel.fillStyle(0xfffff4, 0.97)
    panel.fillRoundedRect(40, 214, 688, 350, 34)
    panel.lineStyle(3, 0xe7b45e, 0.48)
    panel.strokeRoundedRect(42, 216, 684, 346, 32)
    this.content.add(panel)

    this.text(384, 276, this.headline(), 24, this.content)
      .setWordWrapWidth(610)
    this.text(384, 326, '不用设置一堆选项，点一个就开始', 18, this.content)
      .setColor('#527267')

    const modes = this.modes()
    modes.forEach((entry, index) => {
      const button = createToolButton(
        this,
        'difficulty',
        entry.label,
        () => this.launch(index, this.roundSeconds(index)),
        { width: 188, height: 62 }
      )
      button.setPosition(160 + index * 224, 414)
      this.content.add(button.container)
    })

    if (this.best > 0) {
      this.text(384, 506, `最高纪录 ${this.best} 分`, 21, this.content)
        .setColor('#527267')
    }
  }

  protected launch(mode: number, seconds: number): void {
    this.mode = mode
    this.best = this.readBest(mode)
    this.remainingMs = seconds * 1000
    this.resetView('')
    this.entities = this.add.container(0, 0)
    this.content.add(this.entities)
    this.startRound(mode)
    this.running = true
  }

  protected endRound(): void {
    this.running = false
    const score = this.roundScore()
    const isBest = score > this.best

    if (isBest) {
      this.best = score
      try {
        window.localStorage.setItem(`${this.bestKey}-${this.mode}`, String(score))
      } catch {
        // 保存失败不影响本局体验。
      }
      recordBest(`${this.gameId}:v2:${this.mode}`, score, false)
      awardLeaf(`${this.gameId}-record`)
    }

    this.audio.playWin()
    this.showResult(score, isBest, this.best)
  }

  /**
   * 统一保留最后一帧世界的结算。
   * accent 参数继续保留 API 兼容，但视觉由 shared Dialog 控制。
   */
  protected showKeptResult(
    score: number,
    isBest: boolean,
    best: number,
    _accent = '#cb6544'
  ): void {
    this.presentResult(score, isBest, best)
  }

  protected showResult(score: number, isBest: boolean, best: number): void {
    this.presentResult(score, isBest, best)
  }

  private presentResult(score: number, isBest: boolean, best: number): void {
    this.say(isBest ? `新纪录 ${score} 分！` : `时间到！本局 ${score} 分`)
    this.resultDialog?.close()

    const title = isBest ? '✦ 新纪录 ✦' : '✦ 时间到 ✦'
    const body = `本局 ${score} 分 · 最高 ${Math.max(score, best)} 分`

    const dialog = showGameDialog(this, {
      title,
      body,
      actions: [
        {
          label: '再来一次',
          primary: true,
          onPress: () => {
            dialog.close()
            this.resultDialog = undefined
            this.replay()
          }
        },
        {
          label: '换个难度',
          onPress: () => {
            dialog.close()
            this.resultDialog = undefined
            this.showIntro()
          }
        }
      ]
    })

    this.resultDialog = dialog
  }

  protected abstract replay(): void

  protected makeDotTexture(key: string, color: number, radius = 5): void {
    if (this.textures.exists(key)) return
    const graphics = this.make.graphics()
    graphics.fillStyle(color)
    graphics.fillCircle(radius, radius, radius)
    graphics.generateTexture(key, radius * 2, radius * 2)
    graphics.destroy()
  }

  protected spray(
    textureKey: string,
    x: number,
    y: number,
    count: number,
    speed: number,
    lifespan = 520
  ): void {
    let emitter = this.bursts.get(textureKey)
    if (!emitter) {
      emitter = this.add.particles(0, 0, textureKey, {
        speed: { min: speed * 0.4, max: speed },
        lifespan,
        scale: { start: 1, end: 0.2 },
        alpha: { start: 0.9, end: 0 },
        gravityY: 180,
        maxParticles: 64,
        maxAliveParticles: 64,
        emitting: false
      })
      this.entities.add(emitter)
      this.bursts.set(textureKey, emitter)
    }

    emitter.explode(Math.min(24, Math.max(0, count)), x, y)
  }
}
