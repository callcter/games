import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordBest } from '../puzzle-kit/progress'
import { awardLeaf } from '../../app/tree'

// 动作游戏共享的实体活动区：避开 puzzle-kit 头部（y≤210）与底部按钮行（y≥850）。
export const FIELD = { top: 228, bottom: 845 } as const

/**
 * 动作游戏基类：在回合制 PuzzleScene 之上补齐逐帧循环、限时回合、
 * 开始/结束面板与最高分。子类实现 modes/startRound/tick/statusLine/roundScore，
 * 用 launch()/endRound() 控制回合，实体画到 this.entities。
 */
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

  protected onRoundInput(event: string, handler: (pointer: Phaser.Input.Pointer) => void): void {
    this.input.on(event, handler)
    this.roundInputs.push(() => this.input.off(event, handler))
  }

  protected override resetView(message: string): void {
    this.roundInputs.splice(0).forEach(remove => remove())
    this.bursts.clear()
    // 动作游戏的补间都属于当前面板/回合，结束时不能继续操作已销毁的图片。
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
      const value=Number(window.localStorage.getItem(`${this.bestKey}-${mode}`))
      return Number.isFinite(value) && value>=0 ? value : 0
    } catch { return 0 }
  }

  /** 难度档位文案，下标即 mode。 */
  protected abstract modes(): readonly { label: string }[]
  /** 进入某一档：初始化规则状态并搭建本回合实体。 */
  protected abstract startRound(mode: number): void
  /** running 时的逐帧推进，delta 已钳制到 ≤50ms。 */
  protected abstract tick(delta: number): void
  /** 状态行文案（分数、剩余时间等），每帧刷新。 */
  protected abstract statusLine(): string
  /** 本回合得分，结算面板与最高分用。 */
  protected abstract roundScore(): number
  /** 面板副标题：本游戏的一句话玩法说明。 */
  protected abstract headline(): string
  /** 某难度档的回合秒数。 */
  protected abstract roundSeconds(mode: number): number

  protected start(): void {
    this.showIntro()
  }

  update(_time: number, delta: number): void {
    if (!this.running) return
    // 切后台恢复时 delta 可能巨大，钳制避免实体瞬移或时间瞬间耗尽。
    const clamped = Math.min(delta, 50)
    this.remainingMs -= clamped
    this.tick(clamped)
    this.showHud()
    if (this.remainingMs <= 0) this.endRound()
  }

  /** 回合中 HUD：默认写 puzzle 状态行；子类可覆写为自绘视觉块（分数/时间拆分）。 */
  protected showHud(): void {
    this.say(this.statusLine())
  }

  protected get remainingSeconds(): number {
    return Math.max(0, Math.ceil(this.remainingMs / 100) / 10)
  }

  /** 增减剩余时间（切到炸弹等惩罚），本回合内生效。 */
  protected addTime(deltaMs: number): void {
    this.remainingMs = Math.max(0, this.remainingMs + deltaMs)
  }

  protected showIntro(): void {
    this.running = false
    this.best=Math.max(...[0,1,2].map(mode=>this.readBest(mode)))
    this.resetView('选一个难度开始')
    this.text(384, 268, this.headline(), 23, this.content).setWordWrapWidth(660)
    this.modes().forEach((entry, index) => {
      this.button(160 + index * 224, 400, entry.label, () => this.launch(index, this.roundSeconds(index)), 204, this.content)
    })
    if (this.best > 0) this.text(384, 520, `最高纪录 ${this.best} 分`, 22, this.content)
  }

  protected launch(mode: number, seconds: number): void {
    this.mode = mode
    this.best=this.readBest(mode)
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
      // 第一次刷新个人纪录也是自然目标，给小树一片叶子。
      awardLeaf(`${this.gameId}-record`)
    }
    this.audio.playWin()
    this.showResult(score, isBest, this.best)
  }

  /** 动作游戏通用「保留游戏世界」结算：只压暗不清场，卡片从底部弹出（Wave 3）。
   * accent 为主按钮底色，各游戏可用自己的强调色。 */
  protected showKeptResult(score: number, isBest: boolean, best: number, accent = '#cb6544'): void {
    this.say(isBest ? `新纪录 ${score} 分！` : `时间到！本局 ${score} 分`)
    const dim = this.add.rectangle(384, 450, 768, 900, 0x173f35, 0.36).setInteractive()
    this.content.add(dim)
    const card = this.add.container(384, 0)
    this.content.add(card)
    const panel = this.add.graphics()
    panel.fillStyle(0xfffdf6, 0.98)
    panel.fillRoundedRect(-235, -160, 470, 320, 24)
    panel.lineStyle(3, 0xd8cdbb, 1)
    panel.strokeRoundedRect(-235, -160, 470, 320, 24)
    card.add(panel)
    const banner = this.add.text(0, -108, isBest ? '✦ 新纪录 ✦' : '✦ 时间到 ✦', {
      color: isBest ? accent : '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '36px', fontStyle: 'bold'
    }).setOrigin(0.5)
    card.add(banner)
    banner.setScale(0.7)
    this.tweens.add({ targets: banner, scale: 1, duration: 260, ease: 'Back.Out' })
    card.add(this.add.text(0, -44, `本局 ${score} 分 · 最高 ${Math.max(score, best)} 分`, {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '22px'
    }).setOrigin(0.5))
    const replay = this.add.text(0, 32, '再来一次', {
      color: '#fffaf0', backgroundColor: accent,
      fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '23px', fontStyle: 'bold',
      padding: { x: 30, y: 13 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.replay())
    card.add(replay)
    const change = this.add.text(0, 118, '换个难度', {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '18px'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.showIntro())
    card.add(change)
    card.y = 1150
    this.tweens.add({ targets: card, y: 560, duration: 340, ease: 'Back.Out' })
  }

  /** 结算面板：默认清场进入统一结算页；子类可覆写为保留最后一帧的 overlay（EXPERIENCE-2 §9）。 */
  protected showResult(score: number, isBest: boolean, best: number): void {
    this.resetView(isBest ? `新纪录 ${score} 分！` : `时间到！本局 ${score} 分`)
    const banner = this.text(384, 420, isBest ? '✦ 新纪录 ✦' : '✦ 时间到 ✦', 34, this.content)
    banner.setScale(0.7)
    this.tweens.add({ targets: banner, scale: 1, duration: 260, ease: 'Back.Out' })
    this.text(384, 500, `本局 ${score} 分 · 最高 ${best} 分`, 24, this.content)
    this.button(240, 640, '再来一次', () => this.replay(), 190, this.content)
    this.button(528, 640, '换个难度', () => this.showIntro(), 190, this.content)
  }

  /** 结束后重开：默认同难度，子类可覆写带回合秒数。 */
  protected abstract replay(): void

  /** 生成一个小圆点纹理（粒子用），重复调用安全。 */
  protected makeDotTexture(key: string, color: number, radius = 5): void {
    if (this.textures.exists(key)) return
    const graphics = this.make.graphics()
    graphics.fillStyle(color)
    graphics.fillCircle(radius, radius, radius)
    graphics.generateTexture(key, radius * 2, radius * 2)
    graphics.destroy()
  }

  /** 复用每回合的粒子池；每种纹理最多 64 个存活粒子，回合结束统一销毁。 */
  protected spray(textureKey: string, x: number, y: number, count: number, speed: number, lifespan = 520): void {
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
    // 粒子位置相对发射器；原点只应用一次。每种纹理复用粒子池，不为每次点击创建计时器。
    emitter.explode(Math.min(24, Math.max(0, count)), x, y)
  }
}
