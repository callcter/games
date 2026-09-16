import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { ActionScene, FIELD } from '../action-kit/scene'
import { comboFactor, MODES, newGame, step, tap, type Drop } from './core/game'

export class RedRainScene extends ActionScene {
  private state = newGame()
  private views: Phaser.GameObjects.Image[] = []
  constructor(audio: GameAudio, exit: () => void) { super('red-rain', '红包雨', audio, exit) }
  protected modes(): readonly { label: string }[] {
    return MODES.map((entry, index) => ({ label: `${this.mode === index ? '✓ ' : ''}${entry.label}` }))
  }
  protected headline(): string { return '点开落下的红包收福分，连击有加倍；炮仗别点，会扣分' }
  protected roundSeconds(_mode: number): number { return 45 }
  protected replay(): void { this.launch(this.mode, this.roundSeconds(this.mode)) }
  protected roundScore(): number { return this.state.score }
  protected statusLine(): string {
    const combo = this.state.combo >= 2 ? ` · 连击 x${comboFactor(this.state.combo)}` : ''
    return `福分 ${this.state.score} · 已收 ${this.state.opened} 个${combo} · 剩余 ${this.remainingSeconds} 秒`
  }
  protected startRound(mode: number): void {
    this.state = newGame(mode)
    this.views = []
    this.makePacketTextures()
    this.makeDotTexture('gold-coin', 0xe6b84d, 6)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.running) return
      const index = this.nearestDrop(pointer.x, pointer.y)
      if (index < 0) return
      const drop = this.state.drops[index]!
      const before = this.state.score
      const result = tap(this.state, drop.x, drop.y)
      if (result.kind === 'none') return
      this.state = result.state
      this.views.splice(index, 1)[0]?.destroy()
      if (result.kind === 'cracker') {
        this.audio.playBurst()
        this.cameras.main.shake(120, 0.003)
        this.floatText(drop.x, drop.y, '-3', '#c0392b')
        return
      }
      this.audio.playPop(1.4)
      this.spray('gold-coin', drop.x, drop.y, 11, 210)
      this.blessing(drop.x, drop.y)
      this.floatText(drop.x, drop.y - 10, `+${this.state.score - before}`, '#d9a12e')
    })
  }
  protected tick(delta: number): void {
    this.state = step(this.state, delta)
    if (this.views.length !== this.state.drops.length) {
      this.views.forEach(view => view.destroy())
      this.views = this.state.drops.map(drop => this.makeDrop(drop))
      return
    }
    this.state.drops.forEach((drop, index) => this.views[index]!.setPosition(drop.x, drop.y))
  }
  // 红包在持续下落，点击判定取点击瞬间最近的实体索引交给 core 的 tap 处理。
  private nearestDrop(x: number, y: number): number {
    let best = -1, distance = Infinity
    this.state.drops.forEach((drop, index) => {
      const current = Math.hypot(drop.x - x, drop.y - y)
      if (current <= 52 && current < distance) { best = index; distance = current }
    })
    return best
  }
  private makeDrop(drop: Drop): Phaser.GameObjects.Image {
    const view = this.add.image(drop.x, drop.y, drop.cracker ? 'firecracker' : 'red-packet')
    this.entities.add(view)
    return view
  }
  private makePacketTextures(): void {
    if (this.textures.exists('red-packet')) return
    const graphics = this.make.graphics()
    graphics.fillStyle(0xd94f43)
    graphics.fillRoundedRect(3, 3, 62, 82, 9)
    graphics.lineStyle(3, 0xe6b84d)
    graphics.strokeRoundedRect(3, 3, 62, 82, 9)
    graphics.fillStyle(0xb53d33)
    graphics.fillRoundedRect(3, 3, 62, 24, 9)
    graphics.lineStyle(2, 0xe6b84d)
    graphics.lineBetween(3, 27, 65, 27)
    graphics.generateTexture('red-packet', 68, 88)
    graphics.clear()
    graphics.fillStyle(0x4a5568)
    graphics.fillRoundedRect(11, 9, 24, 62, 10)
    graphics.lineStyle(3, 0xe6b84d)
    graphics.strokeRoundedRect(11, 9, 24, 62, 10)
    graphics.fillStyle(0xe88065)
    graphics.fillCircle(23, 7, 5)
    graphics.lineStyle(2, 0xe88065)
    graphics.lineBetween(23, 7, 31, 1)
    graphics.generateTexture('firecracker', 46, 78)
    graphics.destroy()
  }
  // 开包的「福」字小弹跳，替代红包撕裂动画。
  private blessing(x: number, y: number): void {
    const label = this.text(x, Math.max(FIELD.top + 24, y - 24), '福', 30, this.entities).setColor('#d9a12e')
    label.setScale(0.4)
    this.tweens.add({ targets: label, y: label.y - 56, alpha: 0, scale: 1, duration: 560, ease: 'Back.Out', onComplete: () => label.destroy() })
  }
  private floatText(x: number, y: number, content: string, color: string): void {
    const label = this.text(x, y, content, 24, this.entities).setColor(color)
    this.tweens.add({ targets: label, y: label.y - 44, alpha: 0, duration: 500, ease: 'Cubic.Out', onComplete: () => label.destroy() })
  }
}
