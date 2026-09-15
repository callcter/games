import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import {
  BOARD_SIZE,
  moveGame,
  newGame,
  type Direction,
  type Game2048State
} from './core/game'

interface SceneCallbacks {
  onExit: () => void
  onStateChange: (state: Game2048State) => void
}

interface TileAnimations {
  newIndices: ReadonlySet<number>
  mergedIndices: ReadonlySet<number>
}

const TILE_COLORS: Record<number, { background: number; foreground: string }> = {
  0: { background: 0xc9c1ad, foreground: '#6d6658' },
  2: { background: 0xeee7d8, foreground: '#554f44' },
  4: { background: 0xe8dcc0, foreground: '#554f44' },
  8: { background: 0xf2aa62, foreground: '#fffaf0' },
  16: { background: 0xef8751, foreground: '#fffaf0' },
  32: { background: 0xe96b4a, foreground: '#fffaf0' },
  64: { background: 0xd94c38, foreground: '#fffaf0' },
  128: { background: 0xe5be56, foreground: '#fffaf0' },
  256: { background: 0xdcae3e, foreground: '#fffaf0' },
  512: { background: 0xd39c2e, foreground: '#fffaf0' },
  1024: { background: 0xc88724, foreground: '#fffaf0' },
  2048: { background: 0xb86e22, foreground: '#fffaf0' }
}

export class Game2048Scene extends Phaser.Scene {
  private state: Game2048State
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks
  private pointerStart: Phaser.Math.Vector2 | null = null
  private tileAnimations: TileAnimations

  constructor(state: Game2048State, audio: GameAudio, callbacks: SceneCallbacks) {
    super({ key: 'game-2048' })
    this.state = state
    this.audio = audio
    this.callbacks = callbacks
    this.tileAnimations = {
      newIndices: new Set(state.board.flatMap((value, index) => value === 0 ? [] : [index])),
      mergedIndices: new Set()
    }
  }

  create(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      void this.audio.unlock()
      this.pointerStart = new Phaser.Math.Vector2(pointer.x, pointer.y)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.handleSwipe(pointer))
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      void this.audio.unlock()
      this.handleKey(event)
    })
    this.scale.on('resize', () => this.draw())
    this.draw()
  }

  private handleSwipe(pointer: Phaser.Input.Pointer): void {
    if (!this.pointerStart) return
    const deltaX = pointer.x - this.pointerStart.x
    const deltaY = pointer.y - this.pointerStart.y
    this.pointerStart = null
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 28) return

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      this.move(deltaX > 0 ? 'right' : 'left')
    } else {
      this.move(deltaY > 0 ? 'down' : 'up')
    }
  }

  private handleKey(event: KeyboardEvent): void {
    const directions: Partial<Record<string, Direction>> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'
    }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    this.move(direction)
  }

  private move(direction: Direction): void {
    const previous = this.state
    const result = moveGame(this.state, direction)
    if (!result.moved) return
    this.state = result.state
    this.tileAnimations = {
      newIndices: new Set(result.spawnedIndex === null ? [] : [result.spawnedIndex]),
      mergedIndices: new Set(result.mergedIndices)
    }
    if (!previous.won && this.state.won) this.audio.playWin()
    else if (!previous.gameOver && this.state.gameOver) this.audio.playGameOver()
    else if (this.state.score > previous.score) this.audio.playMerge()
    else this.audio.playMove()
    this.callbacks.onStateChange(this.state)
    this.draw()
  }

  private restart(): void {
    this.state = newGame(this.state.bestScore)
    this.tileAnimations = {
      newIndices: new Set(this.state.board.flatMap((value, index) => value === 0 ? [] : [index])),
      mergedIndices: new Set()
    }
    this.audio.playRestart()
    this.callbacks.onStateChange(this.state)
    this.draw()
  }

  private draw(): void {
    const animations = this.tileAnimations
    this.tileAnimations = { newIndices: new Set(), mergedIndices: new Set() }
    this.tweens.killAll()
    this.children.removeAll(true)
    const width = this.scale.width
    const height = this.scale.height
    const compact = height < 650
    const margin = Math.max(16, Math.min(32, width * 0.04))
    const top = compact ? 72 : 124
    const availableHeight = height - top - margin
    const boardSize = Math.min(width - margin * 2, availableHeight, 650)
    const boardX = (width - boardSize) / 2
    const boardY = top + Math.max(0, (availableHeight - boardSize) / 2)

    this.cameras.main.setBackgroundColor('#f8f1df')
    this.add.text(margin, compact ? 18 : 34, '‹ 游戏屋', {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: compact ? '20px' : '24px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', this.callbacks.onExit)

    this.add.text(width / 2, compact ? 24 : 42, '2048', {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: compact ? '30px' : '44px', fontStyle: 'bold'
    }).setOrigin(0.5, 0)

    this.add.text(width - margin, compact ? 18 : 34, '重新开始', {
      color: '#cb6544', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: compact ? '18px' : '21px', fontStyle: 'bold'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())

    this.add.text(margin, compact ? 48 : 76, this.audio.isMuted ? '♪ 声音关' : '♫ 声音开', {
      color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: compact ? '14px' : '16px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.audio.toggleMuted()
      this.draw()
    })

    if (!compact) {
      this.add.text(width / 2, 92, `得分 ${this.state.score}　最高 ${this.state.bestScore}`, {
        color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
        fontSize: '19px', fontStyle: 'bold'
      }).setOrigin(0.5, 0)
    }

    if (this.state.won && !this.state.gameOver) {
      this.add.text(width / 2, compact ? 61 : 119, '太棒了，你已经合成 2048！', {
        color: '#cb6544', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
        fontSize: compact ? '14px' : '16px', fontStyle: 'bold'
      }).setOrigin(0.5, 0)
    }

    const graphics = this.add.graphics()
    graphics.fillStyle(0x9a927f, 1)
    graphics.fillRoundedRect(boardX, boardY, boardSize, boardSize, boardSize * 0.045)

    const gap = boardSize * 0.022
    const cellSize = (boardSize - gap * (BOARD_SIZE + 1)) / BOARD_SIZE
    this.state.board.forEach((_value, index) => {
      const column = index % BOARD_SIZE
      const row = Math.floor(index / BOARD_SIZE)
      const x = boardX + gap + column * (cellSize + gap)
      const y = boardY + gap + row * (cellSize + gap)
      graphics.fillStyle(0xc9c1ad, 1)
      graphics.fillRoundedRect(x, y, cellSize, cellSize, cellSize * 0.09)
    })

    this.state.board.forEach((value, index) => {
      if (value === 0) return
      const column = index % BOARD_SIZE
      const row = Math.floor(index / BOARD_SIZE)
      const x = boardX + gap + column * (cellSize + gap)
      const y = boardY + gap + row * (cellSize + gap)
      const colors = TILE_COLORS[value] ?? { background: 0x9f5630, foreground: '#fffaf0' }
      const tile = this.add.container(x + cellSize / 2, y + cellSize / 2)
      const tileGraphics = new Phaser.GameObjects.Graphics(this)
      tileGraphics.fillStyle(colors.background, 1)
      tileGraphics.fillRoundedRect(-cellSize / 2, -cellSize / 2, cellSize, cellSize, cellSize * 0.09)

      const digits = String(value).length
      const fontSize = Math.floor(cellSize * (digits <= 2 ? 0.38 : digits === 3 ? 0.31 : 0.25))
      const label = new Phaser.GameObjects.Text(this, 0, 0, String(value), {
        color: colors.foreground,
        fontFamily: 'Avenir Next, PingFang SC, sans-serif',
        fontSize: `${fontSize}px`, fontStyle: 'bold'
      }).setOrigin(0.5)
      tile.add([tileGraphics, label])

      if (animations.newIndices.has(index)) {
        tile.setScale(0.5)
        this.tweens.add({
          targets: tile,
          scaleX: 1,
          scaleY: 1,
          duration: 180,
          ease: 'Cubic.Out'
        })
      } else if (animations.mergedIndices.has(index)) {
        this.tweens.add({
          targets: tile,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 90,
          yoyo: true,
          ease: 'Sine.Out'
        })
      }
    })

    if (this.state.gameOver) this.drawGameOver(boardX, boardY, boardSize)
  }

  private drawGameOver(x: number, y: number, size: number): void {
    const overlay = this.add.graphics()
    overlay.fillStyle(0xf8f1df, 0.86)
    overlay.fillRoundedRect(x, y, size, size, size * 0.045)
    this.add.text(x + size / 2, y + size * 0.39, '再来一局吧', {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: `${Math.max(28, size * 0.075)}px`, fontStyle: 'bold'
    }).setOrigin(0.5)
    this.add.text(x + size / 2, y + size * 0.56, '重新开始', {
      color: '#fffaf0', backgroundColor: '#cb6544',
      fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: `${Math.max(20, size * 0.045)}px`, fontStyle: 'bold',
      padding: { x: 22, y: 13 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())
  }
}
