import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createHeaderButton } from '../../platform/display/header-button'
import { hasPrecisePointer } from '../../platform/input/pointer-capability'
import { FRUIT_LEVELS, fruitAt, mergeFruits, randomDropLevel } from './core/game'

interface SceneCallbacks {
  onExit: () => void
}

const SCENE_WIDTH = 768
const SCENE_HEIGHT = 1024
const BOWL_LEFT = 134
const BOWL_RIGHT = 634
const BOWL_TOP = 286
const BOWL_BOTTOM = 912
const WALL_THICKNESS = 28
const DANGER_Y = 348
const DROP_Y = 220
const TEXTURE_SIZE = 128
const TEXTURE_RADIUS = 56
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
  private preview: Phaser.GameObjects.Image | null = null
  private nextPreview: Phaser.GameObjects.Image | null = null
  private scoreText: Phaser.GameObjects.Text | null = null
  private nextText: Phaser.GameObjects.Text | null = null
  private soundText: Phaser.GameObjects.Text | null = null
  private dangerGraphics: Phaser.GameObjects.Graphics | null = null
  private dangerActive: boolean | null = null
  private nextDangerCheck = 0

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
    if (this.gameOver || time < this.nextDangerCheck) return
    this.nextDangerCheck = time + 50
    let danger = false
    for (const fruit of this.fruits) {
      if (!fruit.active) continue
      const level = Number(fruit.getData('fruitLevel'))
      const radius = fruitAt(level).radius
      const aboveLine = fruit.y - radius < DANGER_Y
      const dangerSince = Number(fruit.getData('dangerSince'))
      if (aboveLine && time - Number(fruit.getData('spawnedAt')) > 900) {
        danger = true
        const since = dangerSince || time
        if (!dangerSince) fruit.setData('dangerSince', since)
        if (time - since > 1700) {
          this.endGame()
          return
        }
      } else if (dangerSince) {
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
      if (level === 0) this.drawCherryTexture(graphics)
      else if (level === 1) this.drawStrawberryTexture(graphics)
      else this.drawRoundFruitTexture(graphics, fruit.color, fruit.accent, level)
      graphics.generateTexture(key, TEXTURE_SIZE, TEXTURE_SIZE)
      graphics.destroy()
    })
  }

  private drawCherryTexture(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(6, 0x47764d, 1)
    graphics.beginPath()
    graphics.moveTo(41, 52)
    graphics.lineTo(57, 19)
    graphics.lineTo(68, 10)
    graphics.moveTo(84, 52)
    graphics.lineTo(70, 14)
    graphics.strokePath()
    graphics.fillStyle(0x57935a, 1)
    graphics.fillEllipse(82, 13, 30, 14)
    graphics.fillStyle(0x000000, 0.14)
    graphics.fillCircle(44, 79, 32)
    graphics.fillCircle(87, 79, 32)
    graphics.fillStyle(0xd83c4b, 1)
    graphics.fillCircle(41, 76, 31)
    graphics.fillCircle(84, 76, 31)
    graphics.fillStyle(0xff8990, 0.78)
    graphics.fillCircle(31, 66, 8)
    graphics.fillCircle(74, 66, 8)
    graphics.fillStyle(0x173f35, 0.82)
    graphics.fillCircle(34, 78, 3)
    graphics.fillCircle(48, 78, 3)
    graphics.lineStyle(2, 0x173f35, 0.72)
    graphics.beginPath()
    graphics.arc(41, 82, 8, 0.22, Math.PI - 0.22)
    graphics.strokePath()
  }

  private drawStrawberryTexture(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x000000, 0.13)
    graphics.fillCircle(42, 50, 29)
    graphics.fillCircle(88, 50, 29)
    graphics.fillTriangle(16, 49, 116, 49, 67, 121)
    graphics.fillStyle(0xf05a61, 1)
    graphics.fillCircle(40, 46, 29)
    graphics.fillCircle(86, 46, 29)
    graphics.fillTriangle(13, 46, 113, 46, 64, 117)
    graphics.fillStyle(0xffd66b, 0.95)
    ;[[31, 55], [96, 55], [40, 78], [88, 80], [63, 95]].forEach(([x, y]) => graphics.fillEllipse(x ?? 0, y ?? 0, 5, 9))
    graphics.fillStyle(0x4f9558, 1)
    graphics.fillTriangle(22, 33, 48, 39, 39, 15)
    graphics.fillTriangle(43, 34, 68, 40, 63, 10)
    graphics.fillTriangle(66, 39, 99, 31, 82, 14)
    this.drawFruitFace(graphics, 64, 61)
  }

  private drawRoundFruitTexture(graphics: Phaser.GameObjects.Graphics, color: number, accent: number, level: number): void {
    graphics.fillStyle(0x000000, 0.13)
    graphics.fillCircle(67, 67, TEXTURE_RADIUS)
    graphics.fillStyle(color, 1)
    graphics.fillCircle(64, 64, TEXTURE_RADIUS)
    // 各级别专属纹路：只靠颜色难区分大小相近的水果，特征形状让孩子一眼认出。
    if (level === 2) this.drawGrapeDetail(graphics)
    else if (level === 3) this.drawTangerineDetail(graphics)
    else if (level === 4) this.drawPersimmonDetail(graphics)
    else if (level === 5) this.drawAppleDetail(graphics)
    else if (level === 6) this.drawPearDetail(graphics)
    else if (level === 7) this.drawPeachDetail(graphics)
    else if (level === 8) this.drawPineappleDetail(graphics)
    else if (level === 9) this.drawMelonDetail(graphics)
    else if (level === 10) this.drawWatermelonDetail(graphics)
    graphics.fillStyle(accent, 0.68)
    graphics.fillCircle(46, 43, 17)
    this.drawFruitFace(graphics, 63, 67)
  }

  /** 葡萄：果梗加放射颗粒分界线。 */
  private drawGrapeDetail(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(3, 0x6a44a0, 0.6)
    for (const spread of [-0.55, 0, 0.55]) {
      graphics.beginPath()
      graphics.moveTo(64, 16)
      graphics.lineTo(64 + Math.sin(spread) * 46, 62 + Math.cos(spread) * 46)
      graphics.strokePath()
    }
    graphics.fillStyle(0x7a4a2b, 1)
    graphics.fillRoundedRect(60, 4, 8, 16, 3)
  }

  /** 凸顶柑：顶部小凸起与表面油胞点。 */
  private drawTangerineDetail(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0xf39a48, 1)
    graphics.fillCircle(64, 16, 10)
    graphics.fillStyle(0xc4722b, 0.4)
    for (const [x, y] of [[42, 62], [58, 88], [84, 58], [88, 86], [50, 40], [76, 100]] as const) graphics.fillCircle(x, y, 3)
  }

  /** 柿子：顶部四片绿色萼片托住。 */
  private drawPersimmonDetail(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x4f7d3f, 1)
    graphics.fillEllipse(64, 14, 30, 13)
    graphics.fillEllipse(48, 20, 15, 11)
    graphics.fillEllipse(80, 20, 15, 11)
    graphics.fillEllipse(64, 24, 12, 9)
    graphics.fillStyle(0x6b9b53, 1)
    graphics.fillCircle(64, 16, 4)
  }

  /** 苹果：顶部凹陷、果梗和一片叶子。 */
  private drawAppleDetail(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(4, 0xb0453c, 0.85)
    graphics.beginPath()
    graphics.arc(64, 34, 14, Math.PI, Math.PI * 2)
    graphics.strokePath()
    graphics.lineStyle(6, 0x7a4a2b, 1)
    graphics.beginPath()
    graphics.moveTo(64, 26)
    graphics.lineTo(70, 6)
    graphics.strokePath()
    graphics.fillStyle(0x4f8d55, 1)
    graphics.fillEllipse(81, 13, 25, 11)
  }

  /** 梨：长果梗与棕色锈斑点。 */
  private drawPearDetail(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(6, 0x7a4a2b, 1)
    graphics.beginPath()
    graphics.moveTo(64, 30)
    graphics.lineTo(58, 4)
    graphics.strokePath()
    graphics.fillStyle(0xb08a3e, 0.35)
    for (const [x, y] of [[44, 58], [86, 52], [56, 92], [82, 96], [40, 84], [96, 76], [68, 44]] as const) graphics.fillCircle(x, y, 4)
  }

  /** 桃子：从顶贯穿的浅色果沟和顶尖小叶。 */
  private drawPeachDetail(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(4, 0xf7c9b8, 0.9)
    graphics.beginPath()
    graphics.moveTo(66, 18)
    graphics.lineTo(60, 52)
    graphics.lineTo(68, 84)
    graphics.strokePath()
    graphics.fillStyle(0x5d9c52, 1)
    graphics.fillTriangle(64, 10, 84, 6, 72, 22)
  }

  /** 菠萝：菱形网格纹与锯齿冠叶。 */
  private drawPineappleDetail(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(3, 0xb8862f, 0.55)
    for (const offset of [-40, -20, 0, 20, 40]) {
      const halfWidth = Math.sqrt(Math.max(0, 50 * 50 - offset * offset))
      graphics.beginPath()
      graphics.moveTo(64 - halfWidth, 64 + offset)
      graphics.lineTo(64 + halfWidth, 64 + offset)
      graphics.moveTo(64 + offset, 64 - halfWidth)
      graphics.lineTo(64 + offset, 64 + halfWidth)
      graphics.strokePath()
    }
    graphics.fillStyle(0x3f7d3a, 1)
    graphics.fillTriangle(48, 20, 64, -6, 60, 24)
    graphics.fillTriangle(62, 22, 76, 2, 74, 26)
  }

  /** 蜜瓜：奶白网纹交叉覆盖。 */
  private drawMelonDetail(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(2.5, 0xe9f2d9, 0.85)
    for (const [x1, y1, x2, y2] of [
      [34, 40, 72, 28], [70, 30, 96, 54], [30, 70, 52, 46], [50, 48, 86, 68],
      [76, 70, 96, 92], [36, 96, 60, 74], [62, 76, 92, 104], [40, 56, 28, 88],
      [70, 100, 44, 108], [84, 44, 104, 72]
    ] as const) {
      graphics.beginPath()
      graphics.moveTo(x1, y1)
      graphics.lineTo(x2, y2)
      graphics.strokePath()
    }
  }

  /** 大西瓜：放射状深绿波浪条纹。 */
  private drawWatermelonDetail(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(13, 0x2e7d4f, 0.9)
    for (const [start, end] of [[-0.42, 0.42], [Math.PI - 0.42, Math.PI + 0.42], [Math.PI / 2 - 0.4, Math.PI / 2 + 0.4], [Math.PI * 1.5 - 0.4, Math.PI * 1.5 + 0.4]] as const) {
      graphics.beginPath()
      graphics.arc(64, 64, 44, start, end)
      graphics.strokePath()
    }
  }

  private drawFruitFace(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.fillStyle(0x173f35, 0.82)
    graphics.fillCircle(x - 16, y - 2, 4)
    graphics.fillCircle(x + 16, y - 2, 4)
    graphics.lineStyle(3, 0x173f35, 0.72)
    graphics.beginPath()
    graphics.arc(x, y + 4, 15, 0.22, Math.PI - 0.22)
    graphics.strokePath()
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
    createHeaderButton(this, {
      x: SCENE_WIDTH - 28, y: 56, anchor: 'right', label: '重新开始', onTap: () => this.restart()
    })

    this.scoreText = this.add.text(34, 102, this.scoreLabel(), {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '21px', fontStyle: 'bold'
    })
    const nextBubble = this.add.graphics()
    nextBubble.fillStyle(0xffffff, 0.52)
    nextBubble.fillCircle(690, 165, 52)
    nextBubble.lineStyle(3, 0xd8b276, 0.72)
    nextBubble.strokeCircle(690, 165, 52)
    this.add.text(690, 94, '下一个', {
      color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '17px', fontStyle: 'bold'
    }).setOrigin(0.5, 0)
    this.nextText = this.add.text(690, 218, '', {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '15px', fontStyle: 'bold'
    }).setOrigin(0.5, 0)
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

    // 触屏环境不提示键盘投放方式
    const dropHint = hasPrecisePointer() ? '轻点位置投放 · 也可用 ← → 移动，空格投放' : '轻点位置投放'
    this.add.text(SCENE_WIDTH / 2, 952, dropHint, {
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
    image.setCircle(TEXTURE_RADIUS, { restitution: 0.12, friction: 0.08, frictionAir: 0.006, density: 0.0016 })
    const displaySize = this.displaySizeForRadius(fruit.radius)
    image.setDisplaySize(displaySize, displaySize)
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

    const result = mergeFruits(level, level)
    if (!result) return

    const x = (first.x + second.x) / 2
    const y = (first.y + second.y) / 2
    const velocityX = ((first.body?.velocity.x ?? 0) + (second.body?.velocity.x ?? 0)) / 2
    const velocityY = Math.min(0, ((first.body?.velocity.y ?? 0) + (second.body?.velocity.y ?? 0)) / 2 - 2.2)
    this.removeFruit(first)
    this.removeFruit(second)
    if (result.nextLevel === null) {
      this.animateWatermelonClear(x, y)
    } else {
      const merged = this.spawnFruit(x, y, result.nextLevel)
      merged.setVelocity(velocityX, velocityY)
      this.animateMerge(x, y, level, result.nextLevel, merged)
    }

    this.score += result.score
    if (this.score > this.bestScore) {
      this.bestScore = this.score
      writeBestScore(this.bestScore)
    }
    this.scoreText?.setText(this.scoreLabel())
    this.audio.playMerge()
  }

  private animateMerge(x: number, y: number, fromLevel: number, toLevel: number, merged: FruitImage): void {
    merged.setAlpha(0)
    const fromRadius = fruitAt(fromLevel).radius
    const toRadius = fruitAt(toLevel).radius
    const burst = this.add.image(x, y, this.textureKey(toLevel)).setDepth(100)
    const fromSize = this.displaySizeForRadius(fromRadius)
    const toSize = this.displaySizeForRadius(toRadius)
    burst.setDisplaySize(fromSize, fromSize)
    this.tweens.add({
      targets: burst,
      displayWidth: toSize * 1.09,
      displayHeight: toSize * 1.09,
      duration: 170,
      ease: 'Back.Out',
      onComplete: () => {
        burst.destroy()
        if (merged.active) merged.setAlpha(1)
      }
    })
  }

  private animateWatermelonClear(x: number, y: number): void {
    const ring = this.add.graphics().setDepth(100)
    ring.lineStyle(10, 0xffd47b, 0.9)
    ring.strokeCircle(x, y, 72)
    ring.setScale(0.6)
    this.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy()
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
    const currentSize = this.displaySizeForRadius(current.radius)
    this.preview.setDisplaySize(currentSize, currentSize)
    const next = fruitAt(this.nextLevel)
    this.nextPreview = this.add.image(690, 165, this.textureKey(this.nextLevel)).setDepth(20)
    const nextSize = Phaser.Math.Clamp(this.displaySizeForRadius(next.radius), 42, 76)
    this.nextPreview.setDisplaySize(nextSize, nextSize)
    this.nextText?.setText(next.name)
  }

  private drawDangerLine(active: boolean): void {
    if (!this.dangerGraphics || this.dangerActive === active) return
    this.dangerActive = active
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
    this.preview = null
    this.nextPreview = null
    this.scoreText = null
    this.nextText = null
    this.soundText = null
    this.dangerGraphics = null
    this.dangerActive = null
    this.nextDangerCheck = 0
    this.scene.restart()
  }

  private scoreLabel(): string {
    return `得分 ${this.score}　最高 ${this.bestScore}`
  }

  private textureKey(level: number): string {
    return `fruit-v2-${level}`
  }

  private displaySizeForRadius(radius: number): number {
    return radius * 2 * TEXTURE_SIZE / (TEXTURE_RADIUS * 2)
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
