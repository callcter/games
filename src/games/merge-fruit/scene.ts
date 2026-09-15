import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { FRUIT_LEVELS, fruitAt, mergeFruits, randomDropLevel } from './core/game'

interface SceneCallbacks {
  onExit: () => void
}

const SCENE_WIDTH = 768
const SCENE_HEIGHT = 1024
const BOWL_LEFT = 104
const BOWL_RIGHT = 664
const BOWL_TOP = 286
const BOWL_BOTTOM = 912
const WALL_THICKNESS = 28
const DANGER_Y = 348
const DROP_Y = 220
const BEST_SCORE_KEY = 'family-game-room-merge-fruit-best'

type FruitImage = Phaser.Physics.Matter.Image

export class MergeFruitScene extends Phaser.Scene {
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks
  private readonly fruits = new Set<FruitImage>()
  private readonly mergingBodies = new Set<number>()
  private score = 0
  private bestScore = readBestScore()
  private currentLevel = 0
  private nextLevel = 0
  private guideX = SCENE_WIDTH / 2
  private canDrop = true
  private gameOver = false
  private lastMergeAt = 0
  private chain = 0
  private preview: Phaser.GameObjects.Image | null = null
  private nextPreview: Phaser.GameObjects.Image | null = null
  private scoreText: Phaser.GameObjects.Text | null = null
  private nextText: Phaser.GameObjects.Text | null = null
  private soundText: Phaser.GameObjects.Text | null = null
  private dangerGraphics: Phaser.GameObjects.Graphics | null = null

  constructor(audio: GameAudio, callbacks: SceneCallbacks) {
    super({ key: 'merge-fruit' })
    this.audio = audio
    this.callbacks = callbacks
  }

  create(): void {
    this.createFruitTextures()
    this.createWorld()
    this.currentLevel = randomDropLevel()
    this.nextLevel = randomDropLevel()
    this.drawInterface()
    this.refreshPreviews()

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.moveGuide(pointer.x))
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      void this.audio.unlock()
      if (pointer.y > 135) this.moveGuide(pointer.x)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > 135) this.dropFruit()
    })
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      void this.audio.unlock()
      this.handleKey(event)
    })
    this.matter.world.on(
      Phaser.Physics.Matter.Events.COLLISION_START,
      (event: MatterJS.IEventCollision<MatterJS.Engine>) => this.handleCollision(event)
    )
  }

  update(time: number): void {
    if (this.gameOver) return
    let danger = false
    for (const fruit of this.fruits) {
      if (!fruit.active) continue
      const level = Number(fruit.getData('fruitLevel'))
      const radius = fruitAt(level).radius
      const aboveLine = fruit.y - radius < DANGER_Y
      if (aboveLine && time - Number(fruit.getData('spawnedAt')) > 900) {
        danger = true
        const since = Number(fruit.getData('dangerSince')) || time
        fruit.setData('dangerSince', since)
        if (time - since > 1700) {
          this.endGame()
          return
        }
      } else {
        fruit.setData('dangerSince', 0)
      }
    }
    this.drawDangerLine(danger)
  }

  private createFruitTextures(): void {
    FRUIT_LEVELS.forEach((fruit, level) => {
      const key = this.textureKey(level)
      if (this.textures.exists(key)) return
      const graphics = this.add.graphics()
      graphics.fillStyle(0x000000, 0.13)
      graphics.fillCircle(67, 69, 56)
      graphics.fillStyle(fruit.color, 1)
      graphics.fillCircle(64, 64, 56)
      graphics.fillStyle(fruit.accent, 0.68)
      graphics.fillCircle(48, 44, 17)
      graphics.fillStyle(0x173f35, 0.82)
      graphics.fillCircle(47, 66, 4)
      graphics.fillCircle(79, 66, 4)
      graphics.lineStyle(3, 0x173f35, 0.72)
      graphics.beginPath()
      graphics.arc(63, 72, 15, 0.22, Math.PI - 0.22)
      graphics.strokePath()
      if (level !== 2 && level !== 7) {
        graphics.fillStyle(0x4f8d55, 1)
        graphics.fillEllipse(70, 8, 28, 13)
      }
      graphics.generateTexture(key, 128, 128)
      graphics.destroy()
    })
  }

  private createWorld(): void {
    this.matter.world.setBounds(0, 0, SCENE_WIDTH, SCENE_HEIGHT, WALL_THICKNESS, true, true, false, true)
    this.matter.add.rectangle(BOWL_LEFT - WALL_THICKNESS / 2, (BOWL_TOP + BOWL_BOTTOM) / 2, WALL_THICKNESS, BOWL_BOTTOM - BOWL_TOP + WALL_THICKNESS, { isStatic: true })
    this.matter.add.rectangle(BOWL_RIGHT + WALL_THICKNESS / 2, (BOWL_TOP + BOWL_BOTTOM) / 2, WALL_THICKNESS, BOWL_BOTTOM - BOWL_TOP + WALL_THICKNESS, { isStatic: true })
    this.matter.add.rectangle((BOWL_LEFT + BOWL_RIGHT) / 2, BOWL_BOTTOM + WALL_THICKNESS / 2, BOWL_RIGHT - BOWL_LEFT + WALL_THICKNESS * 2, WALL_THICKNESS, { isStatic: true })
  }

  private drawInterface(): void {
    this.cameras.main.setBackgroundColor('#f8f1df')
    this.add.text(28, 34, '‹ 游戏屋', {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '23px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', this.callbacks.onExit)
    this.add.text(SCENE_WIDTH / 2, 30, '合成水果', {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '42px', fontStyle: 'bold'
    }).setOrigin(0.5, 0)
    this.add.text(SCENE_WIDTH - 28, 34, '重新开始', {
      color: '#cb6544', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '21px', fontStyle: 'bold'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())

    this.scoreText = this.add.text(34, 102, this.scoreLabel(), {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '21px', fontStyle: 'bold'
    })
    this.nextText = this.add.text(SCENE_WIDTH - 34, 102, '下一个', {
      color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '17px', fontStyle: 'bold'
    }).setOrigin(1, 0)
    this.soundText = this.add.text(34, 142, this.audio.isMuted ? '♪ 声音关' : '♫ 声音开', {
      color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '16px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.audio.toggleMuted()
      this.soundText?.setText(this.audio.isMuted ? '♪ 声音关' : '♫ 声音开')
    })

    const bowl = this.add.graphics()
    bowl.fillStyle(0xd8b276, 0.24)
    bowl.fillRoundedRect(BOWL_LEFT, BOWL_TOP, BOWL_RIGHT - BOWL_LEFT, BOWL_BOTTOM - BOWL_TOP, 22)
    bowl.lineStyle(12, 0x9c7047, 1)
    bowl.beginPath()
    bowl.moveTo(BOWL_LEFT, BOWL_TOP)
    bowl.lineTo(BOWL_LEFT, BOWL_BOTTOM)
    bowl.lineTo(BOWL_RIGHT, BOWL_BOTTOM)
    bowl.lineTo(BOWL_RIGHT, BOWL_TOP)
    bowl.strokePath()
    this.dangerGraphics = this.add.graphics()
    this.drawDangerLine(false)

    this.add.text(SCENE_WIDTH / 2, 952, '轻点位置投放 · Mac 可用 ← → 移动，空格投放', {
      color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '16px'
    }).setOrigin(0.5)
  }

  private moveGuide(x: number): void {
    if (!this.canDrop || this.gameOver) return
    const radius = fruitAt(this.currentLevel).radius
    this.guideX = Phaser.Math.Clamp(x, BOWL_LEFT + radius + 5, BOWL_RIGHT - radius - 5)
    if (this.preview) this.preview.x = this.guideX
  }

  private dropFruit(): void {
    if (!this.canDrop || this.gameOver) return
    this.canDrop = false
    const level = this.currentLevel
    this.spawnFruit(this.guideX, DROP_Y, level)
    this.audio.playPlace(2)
    this.currentLevel = this.nextLevel
    this.nextLevel = randomDropLevel()
    this.refreshPreviews()
    this.time.delayedCall(430, () => {
      if (!this.gameOver) {
        this.canDrop = true
        this.moveGuide(this.guideX)
      }
    })
  }

  private spawnFruit(x: number, y: number, level: number): FruitImage {
    const fruit = fruitAt(level)
    const image = this.matter.add.image(x, y, this.textureKey(level))
    image.setCircle(56, { restitution: 0.12, friction: 0.08, frictionAir: 0.006, density: 0.0016 })
    image.setDisplaySize(fruit.radius * 2, fruit.radius * 2)
    image.setDataEnabled()
    image.setData('fruitLevel', level)
    image.setData('spawnedAt', this.time.now)
    image.setData('dangerSince', 0)
    image.setDepth(4 + level)
    this.fruits.add(image)
    return image
  }

  private handleCollision(event: MatterJS.IEventCollision<MatterJS.Engine>): void {
    if (this.gameOver) return
    for (const pair of event.pairs) {
      const bodyA = pair.bodyA as unknown as MatterJS.BodyType
      const bodyB = pair.bodyB as unknown as MatterJS.BodyType
      const first = this.fruitFromBody(bodyA)
      const second = this.fruitFromBody(bodyB)
      if (!first || !second || first === second) continue
      const levelA = Number(first.getData('fruitLevel'))
      const levelB = Number(second.getData('fruitLevel'))
      if (!mergeFruits(levelA, levelB)) continue
      if (this.mergingBodies.has(bodyA.id) || this.mergingBodies.has(bodyB.id)) continue
      this.mergingBodies.add(bodyA.id)
      this.mergingBodies.add(bodyB.id)
      this.time.delayedCall(0, () => this.performMerge(first, second, levelA, bodyA.id, bodyB.id))
    }
  }

  private performMerge(first: FruitImage, second: FruitImage, level: number, firstId: number, secondId: number): void {
    this.mergingBodies.delete(firstId)
    this.mergingBodies.delete(secondId)
    if (!first.active || !second.active || this.gameOver) return

    const now = this.time.now
    this.chain = now - this.lastMergeAt < 650 ? this.chain + 1 : 1
    this.lastMergeAt = now
    const result = mergeFruits(level, level, this.chain)
    if (!result) return

    const x = (first.x + second.x) / 2
    const y = (first.y + second.y) / 2
    const velocityX = ((first.body?.velocity.x ?? 0) + (second.body?.velocity.x ?? 0)) / 2
    const velocityY = Math.min(0, ((first.body?.velocity.y ?? 0) + (second.body?.velocity.y ?? 0)) / 2 - 2.2)
    this.removeFruit(first)
    this.removeFruit(second)
    const merged = this.spawnFruit(x, y, result.nextLevel)
    merged.setVelocity(velocityX, velocityY)
    this.animateMerge(x, y, level, result.nextLevel, merged)

    this.score += result.score
    this.bestScore = Math.max(this.bestScore, this.score)
    writeBestScore(this.bestScore)
    this.scoreText?.setText(this.scoreLabel())
    this.audio.playMerge()
  }

  private animateMerge(x: number, y: number, fromLevel: number, toLevel: number, merged: FruitImage): void {
    merged.setAlpha(0)
    const fromRadius = fruitAt(fromLevel).radius
    const toRadius = fruitAt(toLevel).radius
    const burst = this.add.image(x, y, this.textureKey(toLevel)).setDepth(100)
    burst.setDisplaySize(fromRadius * 2, fromRadius * 2)
    this.tweens.add({
      targets: burst,
      displayWidth: toRadius * 2.18,
      displayHeight: toRadius * 2.18,
      duration: 170,
      ease: 'Back.Out',
      onComplete: () => {
        burst.destroy()
        if (merged.active) merged.setAlpha(1)
      }
    })
  }

  private removeFruit(fruit: FruitImage): void {
    this.fruits.delete(fruit)
    fruit.destroy()
  }

  private fruitFromBody(body: MatterJS.BodyType): FruitImage | null {
    const gameObject = body.gameObject ?? body.parent?.gameObject
    return gameObject instanceof Phaser.Physics.Matter.Image && this.fruits.has(gameObject) ? gameObject : null
  }

  private refreshPreviews(): void {
    this.preview?.destroy()
    this.nextPreview?.destroy()
    const current = fruitAt(this.currentLevel)
    this.preview = this.add.image(this.guideX, DROP_Y, this.textureKey(this.currentLevel)).setDepth(20)
    this.preview.setDisplaySize(current.radius * 2, current.radius * 2)
    const next = fruitAt(this.nextLevel)
    this.nextPreview = this.add.image(SCENE_WIDTH - 58, 170, this.textureKey(this.nextLevel)).setDepth(20)
    this.nextPreview.setDisplaySize(next.radius * 1.35, next.radius * 1.35)
    this.nextText?.setText(`下一个 · ${next.name}`)
  }

  private drawDangerLine(active: boolean): void {
    if (!this.dangerGraphics) return
    this.dangerGraphics.clear()
    this.dangerGraphics.lineStyle(active ? 5 : 3, active ? 0xe25037 : 0xcb6544, active ? 0.95 : 0.45)
    this.dangerGraphics.lineBetween(BOWL_LEFT + 8, DANGER_Y, BOWL_RIGHT - 8, DANGER_Y)
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.moveGuide(this.guideX - 26)
    else if (event.key === 'ArrowRight') this.moveGuide(this.guideX + 26)
    else if (event.key === ' ' || event.key === 'ArrowDown') this.dropFruit()
    else return
    event.preventDefault()
  }

  private endGame(): void {
    this.gameOver = true
    this.canDrop = false
    this.preview?.setVisible(false)
    this.matter.world.pause()
    this.audio.playGameOver()

    const panel = this.add.container(SCENE_WIDTH / 2, 570).setDepth(200)
    const background = new Phaser.GameObjects.Graphics(this)
    background.fillStyle(0xf8f1df, 0.96)
    background.fillRoundedRect(-215, -100, 430, 200, 28)
    const title = new Phaser.GameObjects.Text(this, 0, -48, '水果堆满啦', {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '38px', fontStyle: 'bold'
    }).setOrigin(0.5)
    const score = new Phaser.GameObjects.Text(this, 0, 1, `本局得分 ${this.score}`, {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '20px'
    }).setOrigin(0.5)
    const restart = new Phaser.GameObjects.Text(this, 0, 55, '再来一局', {
      color: '#fffaf0', backgroundColor: '#cb6544',
      fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '20px', fontStyle: 'bold',
      padding: { x: 22, y: 11 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())
    panel.add([background, title, score, restart])
    panel.setScale(0.82)
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: 'Back.Out' })
  }

  private restart(): void {
    this.matter.world.resume()
    this.audio.playRestart()
    this.fruits.clear()
    this.mergingBodies.clear()
    this.score = 0
    this.currentLevel = 0
    this.nextLevel = 0
    this.guideX = SCENE_WIDTH / 2
    this.canDrop = true
    this.gameOver = false
    this.lastMergeAt = 0
    this.chain = 0
    this.preview = null
    this.nextPreview = null
    this.scoreText = null
    this.nextText = null
    this.soundText = null
    this.dangerGraphics = null
    this.scene.restart()
  }

  private scoreLabel(): string {
    return `得分 ${this.score}　最高 ${this.bestScore}`
  }

  private textureKey(level: number): string {
    return `fruit-${level}`
  }
}

function readBestScore(): number {
  try {
    const value = Number(window.localStorage.getItem(BEST_SCORE_KEY))
    return Number.isFinite(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

function writeBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(score))
  } catch {
    // 隐私模式下可能无法保存最高分，不影响当前游戏。
  }
}
