import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { ActionScene } from '../action-kit/scene'
import { comboFactor, MODES, newGame, step, whack } from './core/game'
import { MOLE_SHEET_KEY, preloadWhackArt, whackMolesReady, WHACK_BG_KEY, WHACK_HOLE_KEY } from './art'

const HOLE_SPACING = 224
const BOARD_X = 384, BOARD_Y = 528
const HOLE_W = 168, HOLE_H = 76

type HoleView = { mole: Phaser.GameObjects.Image; holeIndex: number }

export class WhackMoleScene extends ActionScene {
  private state = newGame()
  private holes: HoleView[] = []
  private useArtMoles = false

  preload(): void {
    preloadWhackArt(this)
  }

  create(): void {
    // 草地背景铺整张画布，垫在一切视图（intro/回合/结算）之下；素材缺失则保持米色底。
    if (this.textures.exists(WHACK_BG_KEY)) {
      this.add.image(384, 450, WHACK_BG_KEY).setDisplaySize(768, 900).setDepth(-10)
    }
    this.useArtMoles = whackMolesReady(this)
    super.create()
  }
  constructor(audio: GameAudio, exit: () => void) { super('whack-mole', '打地鼠', audio, exit) }
  protected modes(): readonly { label: string }[] {
    return MODES.map((entry, index) => ({ label: `${this.mode === index ? '✓ ' : ''}${entry.label}` }))
  }
  protected headline(): string { return '点冒头的地鼠得分，连击有加倍；戴睡帽的鼠宝宝在睡觉，别打它' }
  protected roundSeconds(_mode: number): number { return 60 }
  /** 时间到保留游戏世界为背景（Wave 3）。 */
  protected override showResult(score: number, isBest: boolean, best: number): void {
    this.showKeptResult(score, isBest, best, '#e6b84d')
  }

  protected replay(): void { this.launch(this.mode, this.roundSeconds(this.mode)) }
  protected roundScore(): number { return this.state.score }
  protected statusLine(): string {
    const combo = this.state.combo >= 2 ? ` · 连击 x${comboFactor(this.state.combo)}` : ''
    return `分数 ${this.state.score} · 打中 ${this.state.hits}${combo} · 剩余 ${this.remainingSeconds} 秒`
  }
  protected startRound(mode: number): void {
    this.state = newGame(mode)
    this.holes = []
    this.makeMoleTextures()
    this.makeDotTexture('mole-star', 0xe6b84d, 6)
    this.buildBoard()
    this.onRoundInput('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.running) return
      this.hammerFlash(pointer.x, pointer.y)
      const hole = this.holeAt(pointer.x, pointer.y)
      if (hole < 0) return
      const before = this.state.score
      const result = whack(this.state, hole)
      if (result.state === this.state) return
      this.state = result.state
      if (result.kind === 'hit') {
        const view = this.holes.find(entry => entry.holeIndex === hole)
        if (view) this.hitThenRetract(view, this.useArtMoles ? 1 : undefined)
        this.audio.playPlace(1)
        this.audio.playPop(2.4)
        this.spray('mole-star', pointer.x, pointer.y - 20, 10, 200)
        this.floatText(pointer.x, pointer.y - 50, `+${this.state.score - before}`, '#2f6f8f')
      } else if (result.kind === 'sleeper') {
        const view = this.holes.find(entry => entry.holeIndex === hole)
        if (view) this.hitThenRetract(view, this.useArtMoles ? 3 : undefined)
        this.audio.playBurst()
        this.floatText(pointer.x, pointer.y - 50, '鼠宝宝在睡觉…', '#c0392b', 20)
      } else {
        this.audio.playMove()
      }
    })
  }
  protected tick(delta: number): void {
    const previous = this.state.holes
    this.state = step(this.state, delta)
    // 新出现的地鼠升起；规则层缩回的做缩回动画
    this.state.holes.forEach((mole, index) => {
      if (mole && !previous[index]) this.raise(index, mole.sleeper)
    })
    previous.forEach((mole, index) => {
      if (mole && !this.state.holes[index]) {
        const view = this.holes.find(entry => entry.holeIndex === index)
        if (view) this.retract(view, false)
      }
    })
  }
  private buildBoard(): void {
    for (let index = 0; index < 9; index++) {
      const x = BOARD_X + (index % 3 - 1) * HOLE_SPACING
      const y = BOARD_Y + (Math.floor(index / 3) - 1) * HOLE_SPACING
      // 素材可用时用立体土丘洞（洞口仍按 HOLE_W×HOLE_H 对齐遮罩与命中判定）。
      const hole = this.textures.exists(WHACK_HOLE_KEY)
        ? this.add.image(x, y, WHACK_HOLE_KEY).setDisplaySize(HOLE_W + 84, HOLE_H + 96)
        : this.add.ellipse(x, y, HOLE_W, HOLE_H, 0x6b4f3a).setStrokeStyle(4, 0x527267)
      this.entities.add(hole)
      const mole = this.useArtMoles
        ? this.add.image(x, y + HOLE_H * 0.55, MOLE_SHEET_KEY, 0).setDisplaySize(112, 112).setVisible(false)
        : this.add.image(x, y + HOLE_H * 0.55, 'mole-normal').setDisplaySize(96,96).setVisible(false)
      this.entities.add(mole)
      // 遮罩：洞口平面以上 + 洞椭圆内部可见，实现「从洞里钻出来」
      const maskShape = this.make.graphics()
      maskShape.fillStyle(0xffffff)
      maskShape.fillRect(0, 0, 768, Math.max(0, y - HOLE_H / 2))
      maskShape.fillEllipse(x, y, HOLE_W + 8, HOLE_H + 8)
      mole.setMask(maskShape.createGeometryMask())
      mole.once('destroy', () => { mole.clearMask(true); maskShape.destroy() })
      this.holes.push({ mole, holeIndex: index })
    }
  }
  private raise(index: number, sleeper: boolean): void {
    const view = this.holes.find(entry => entry.holeIndex === index)
    if (!view) return
    const centerY = this.holeCenterY(index)
    if (this.useArtMoles) view.mole.setTexture(MOLE_SHEET_KEY, sleeper ? 2 : 0).setDisplaySize(112, 112).setVisible(true)
    else view.mole.setTexture(sleeper ? 'mole-sleeper' : 'mole-normal').setDisplaySize(96,96).setVisible(true)
    this.tweens.killTweensOf(view.mole)
    view.mole.y = centerY + HOLE_H * 0.55
    this.tweens.add({ targets: view.mole, y: centerY - 34, duration: 190, ease: 'Back.Out' })
  }
  /** 打中/打错时先定格反馈帧（晕头/惊醒）一小会儿，再缩回洞里。 */
  private hitThenRetract(view: HoleView, frame: number | undefined): void {
    if (frame === undefined) { this.retract(view, true); return }
    this.tweens.killTweensOf(view.mole)
    view.mole.setFrame(frame)
    this.time.delayedCall(260, () => this.retract(view, true))
  }

  private retract(view: HoleView, fast: boolean): void {
    this.tweens.killTweensOf(view.mole)
    this.tweens.add({
      targets: view.mole,
      y: this.holeCenterY(view.holeIndex) + HOLE_H * 0.55,
      duration: fast ? 110 : 160,
      ease: 'Cubic.In',
      onComplete: () => view.mole.setVisible(false)
    })
  }
  private holeCenterY(index: number): number {
    return BOARD_Y + (Math.floor(index / 3) - 1) * HOLE_SPACING
  }
  private holeAt(x: number, y: number): number {
    for (let index = 0; index < 9; index++) {
      const cx = BOARD_X + (index % 3 - 1) * HOLE_SPACING, cy = this.holeCenterY(index)
      if (Math.abs(x - cx) <= HOLE_SPACING / 2 && Math.abs(y - cy) <= HOLE_SPACING / 2) return index
    }
    return -1
  }
  private hammerFlash(x: number, y: number): void {
    const hammer = this.text(x, y - 6, '🔨', 40, this.entities)
    hammer.setScale(1.35)
    this.tweens.add({ targets: hammer, scale: 1, alpha: 0, duration: 240, ease: 'Cubic.Out', onComplete: () => hammer.destroy() })
  }
  private floatText(x: number, y: number, content: string, color: string, size = 24): void {
    const label = this.text(x, Math.max(250, y), content, size, this.entities).setColor(color)
    this.tweens.add({ targets: label, y: label.y - 44, alpha: 0, duration: 520, ease: 'Cubic.Out', onComplete: () => label.destroy() })
  }
  private makeMoleTextures(): void {
    if (this.textures.exists('mole-normal')) return
    const graphics = this.make.graphics().setScale(2)
    const drawMole = (sleeper: boolean, key: string): void => {
      graphics.clear()
      graphics.fillStyle(sleeper ? 0x9aa0a6 : 0xa67c52)
      graphics.fillCircle(48, 58, 34)                       // 身体
      graphics.fillCircle(24, 22, 10)                       // 左耳
      graphics.fillCircle(72, 22, 10)                       // 右耳
      graphics.fillStyle(0xe9dfca)                          // 脸肚
      graphics.fillEllipse(48, 70, 40, 34)
      if (sleeper) {
        graphics.fillStyle(0x7e8dcd)                        // 睡帽
        graphics.fillTriangle(48, -2, 22, 26, 74, 26)
        graphics.fillStyle(0x173f35)                        // 闭眼
        graphics.fillRect(32, 44, 12, 3)
        graphics.fillRect(52, 44, 12, 3)
      } else {
        graphics.fillStyle(0x173f35)                        // 睁眼
        graphics.fillCircle(38, 44, 4)
        graphics.fillCircle(58, 44, 4)
      }
      graphics.fillStyle(0xd9827a)                          // 鼻子
      graphics.fillCircle(48, 56, 5)
      graphics.generateTexture(key, 192, 192)
    }
    drawMole(false, 'mole-normal')
    drawMole(true, 'mole-sleeper')
    graphics.destroy()
  }
}
