import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createHeaderButton } from '../../platform/display/header-button'
import { hasPrecisePointer } from '../../platform/input/pointer-capability'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  ghostRow,
  hardDrop,
  holdPiece,
  isGrounded,
  lockActivePiece,
  moveHorizontal,
  newGame,
  pieceCells,
  rotatePiece,
  softDrop,
  tick,
  type ActionResult,
  type ActivePiece,
  type PieceType
} from './core/game'

interface SceneCallbacks {
  onExit: () => void
}

interface BoardGeometry {
  x: number
  y: number
  width: number
  height: number
  cellSize: number
}

interface SceneLayout {
  compact: boolean
  board: BoardGeometry
  panelWidth: number
  gap: number
}

interface ControlButton {
  text: string
  action: () => void
  repeat?: boolean
}

const PIECE_COLORS: Record<PieceType, number> = {
  I: 0x57c9d8,
  J: 0x5576c9,
  L: 0xe79845,
  O: 0xe5c84f,
  S: 0x70b86d,
  T: 0xa66eb7,
  Z: 0xd96659
}

const BEST_SCORE_KEY = 'family-game-room-tetris-best'

export class TetrisScene extends Phaser.Scene {
  private state = newGame()
  private paused = false
  private dropTimer: Phaser.Time.TimerEvent | null = null
  private lockTimer: Phaser.Time.TimerEvent | null = null
  private repeatDelayTimer: Phaser.Time.TimerEvent | null = null
  private repeatTimer: Phaser.Time.TimerEvent | null = null
  private lockResets = 0
  private bestScore = readBestScore()
  private lineFlash = 0
  private layout: SceneLayout | null = null
  private dynamicLayer: Phaser.GameObjects.Container | null = null
  private pauseButtonText: Phaser.GameObjects.Text | null = null
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks

  constructor(audio: GameAudio, callbacks: SceneCallbacks) {
    super({ key: 'tetris' })
    this.audio = audio
    this.callbacks = callbacks
  }

  create(): void {
    this.input.on('pointerdown', () => void this.audio.unlock())
    this.input.on('pointerup', () => this.stopControlRepeat())
    this.input.on('gameout', () => this.stopControlRepeat())
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      void this.audio.unlock()
      this.handleKey(event)
    })
    this.scale.on('resize', () => this.draw(true))
    this.scheduleDrop()
    this.draw(true)
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === 'p') {
      this.togglePause()
      return
    }
    if (this.paused || this.state.gameOver) return

    const actions: Partial<Record<string, () => void>> = {
      ArrowLeft: () => this.apply(moveHorizontal(this.state, -1), 'move'),
      ArrowRight: () => this.apply(moveHorizontal(this.state, 1), 'move'),
      ArrowDown: () => this.apply(softDrop(this.state), 'soft'),
      ArrowUp: () => this.apply(rotatePiece(this.state), 'move'),
      z: () => this.apply(rotatePiece(this.state, -1), 'move'),
      Z: () => this.apply(rotatePiece(this.state, -1), 'move'),
      x: () => this.apply(rotatePiece(this.state), 'move'),
      X: () => this.apply(rotatePiece(this.state), 'move'),
      c: () => this.applyHold(),
      C: () => this.applyHold(),
      Shift: () => this.applyHold(),
      ' ': () => this.apply(hardDrop(this.state), 'drop')
    }
    const action = actions[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  private apply(result: ActionResult, sound: 'move' | 'soft' | 'drop' | 'tick'): void {
    if (!result.changed) return
    const previousLevel = this.state.level
    const wasGameOver = this.state.gameOver
    this.state = result.state
    if (result.locked) {
      this.lockTimer?.destroy()
      this.lockTimer = null
      this.lockResets = 0
    }
    if (this.state.score > this.bestScore) {
      this.bestScore = this.state.score
      writeBestScore(this.bestScore)
    }

    if (result.clearedLines > 0) {
      this.lineFlash = result.clearedLines
      this.audio.playMerge()
    } else if (result.locked || sound === 'drop') {
      this.audio.playPlace(1)
    } else if (sound === 'move') {
      this.audio.playMove()
    }
    if (!wasGameOver && this.state.gameOver) this.audio.playGameOver()
    if (this.state.level !== previousLevel) this.scheduleDrop()
    this.refreshLockTimer(sound === 'move')
    this.draw()
  }

  private applyHold(): void {
    const result = holdPiece(this.state)
    if (!result.changed) return
    this.lockTimer?.destroy()
    this.lockTimer = null
    this.lockResets = 0
    this.apply(result, 'move')
  }

  private scheduleDrop(): void {
    this.dropTimer?.destroy()
    const delay = Math.max(110, 820 - (this.state.level - 1) * 65)
    this.dropTimer = this.time.addEvent({
      delay,
      loop: true,
      callback: () => {
        if (this.paused || this.state.gameOver) return
        const result = tick(this.state)
        if (result.changed) this.apply(result, 'tick')
        else this.refreshLockTimer(false)
      }
    })
  }

  private refreshLockTimer(requestReset: boolean): void {
    if (this.paused || this.state.gameOver || !isGrounded(this.state)) {
      this.lockTimer?.destroy()
      this.lockTimer = null
      if (!isGrounded(this.state)) this.lockResets = 0
      return
    }

    if (this.lockTimer && (!requestReset || this.lockResets >= 15)) return
    if (this.lockTimer) {
      this.lockTimer.destroy()
      this.lockResets += 1
    }
    this.lockTimer = this.time.delayedCall(500, () => {
      this.lockTimer = null
      if (!this.paused && !this.state.gameOver && isGrounded(this.state)) {
        this.apply(lockActivePiece(this.state), 'tick')
      }
    })
  }

  private togglePause(): void {
    if (this.state.gameOver) return
    this.stopControlRepeat()
    this.paused = !this.paused
    if (this.lockTimer) this.lockTimer.paused = this.paused
    this.draw()
  }

  private restart(): void {
    this.stopControlRepeat()
    this.tweens.killAll()
    this.state = newGame()
    this.paused = false
    this.lineFlash = 0
    this.lockTimer?.destroy()
    this.lockTimer = null
    this.lockResets = 0
    this.audio.playRestart()
    this.scheduleDrop()
    this.draw()
  }

  private draw(rebuildLayout = false): void {
    if (rebuildLayout || !this.layout) this.rebuildStaticLayout()
    const layout = this.layout
    if (!layout) return

    this.dynamicLayer?.removeAll(true)
    this.dynamicLayer?.destroy()
    this.dynamicLayer = this.add.container(0, 0)

    const { board, compact, gap, panelWidth } = layout
    this.drawBoard(board)
    if (panelWidth > 0) this.drawSidePanel(board.x + board.width + gap, board.y, panelWidth, compact)
    this.pauseButtonText?.setText(this.paused ? '继续' : '暂停')
    if (this.lineFlash > 0) this.drawLineFlash(board)
    if (this.paused || this.state.gameOver) this.drawOverlay(board)
    this.lineFlash = 0
  }

  private rebuildStaticLayout(): void {
    this.tweens.killAll()
    this.children.removeAll(true)
    this.dynamicLayer = null
    this.pauseButtonText = null

    const width = this.scale.width
    const height = this.scale.height
    const compact = height < 650
    const margin = Math.max(12, Math.min(26, width * 0.03))
    const headerHeight = compact ? 74 : 112
    const controlsHeight = compact ? 132 : 150
    // 底部至少留 34px：避开 iPad 底部上滑 Home 手势区
    const bottomSafe = Math.max(34, margin)
    const maxBoardHeight = Math.min(780, height - headerHeight - controlsHeight - bottomSafe)
    const panelWidth = width >= 650 ? Math.min(190, width * 0.22) : 0
    const gap = panelWidth > 0 ? margin : 0
    const boardHeight = Math.min(maxBoardHeight, (width - margin * 2 - panelWidth - gap) * 2)
    const boardWidth = boardHeight / 2
    const groupWidth = boardWidth + panelWidth + gap
    const boardX = (width - groupWidth) / 2
    const boardY = headerHeight
    const board: BoardGeometry = {
      x: boardX,
      y: boardY,
      width: boardWidth,
      height: boardHeight,
      cellSize: boardWidth / BOARD_WIDTH
    }

    this.layout = { compact, board, panelWidth, gap }
    this.cameras.main.setBackgroundColor('#f8f1df')
    this.drawHeader(width, compact, margin)
    this.drawControls(width, boardY + boardHeight, compact)
  }

  private addDynamic<T extends Phaser.GameObjects.GameObject>(gameObject: T): T {
    this.dynamicLayer?.add(gameObject)
    return gameObject
  }

  private drawHeader(width: number, compact: boolean, margin: number): void {
    this.add.text(margin, compact ? 14 : 28, '‹ 游戏屋', {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: compact ? '18px' : '22px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', this.callbacks.onExit)

    this.add.text(width / 2, compact ? 15 : 27, '俄罗斯方块', {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: compact ? '25px' : '36px', fontStyle: 'bold'
    }).setOrigin(0.5, 0)

    createHeaderButton(this, {
      x: width - margin, y: compact ? 32 : 40, anchor: 'right', label: '重新开始', onTap: () => this.restart()
    })

    if (!compact) {
      // 触屏环境不展示键盘快捷键，改为说明屏幕按钮
      const hint = hasPrecisePointer()
        ? '方向键移动 · ↑/Z 旋转 · C 暂存 · 空格直落 · P 暂停'
        : '点按钮移动、旋转 · 按住方向可连续移动'
      this.add.text(width / 2, 76, hint, {
        color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '15px'
      }).setOrigin(0.5, 0)
    }
  }

  private drawBoard(geometry: BoardGeometry): void {
    const { x, y, width, height, cellSize } = geometry
    const graphics = this.addDynamic(this.add.graphics())
    graphics.fillStyle(0x173f35, 1)
    graphics.fillRoundedRect(x - 5, y - 5, width + 10, height + 10, 10)
    graphics.fillStyle(0x223f3a, 1)
    graphics.fillRect(x, y, width, height)

    graphics.lineStyle(1, 0xffffff, 0.055)
    for (let column = 1; column < BOARD_WIDTH; column += 1) {
      graphics.lineBetween(x + column * cellSize, y, x + column * cellSize, y + height)
    }
    for (let row = 1; row < BOARD_HEIGHT; row += 1) {
      graphics.lineBetween(x, y + row * cellSize, x + width, y + row * cellSize)
    }

    this.state.board.forEach((cell, index) => {
      if (!cell) return
      this.drawBlock(
        graphics,
        x + (index % BOARD_WIDTH) * cellSize,
        y + Math.floor(index / BOARD_WIDTH) * cellSize,
        cellSize,
        PIECE_COLORS[cell],
        1
      )
    })

    const ghost: ActivePiece = { ...this.state.active, row: ghostRow(this.state) }
    pieceCells(ghost).forEach((cell) => {
      if (cell.row >= 0) this.drawBlock(graphics, x + cell.column * cellSize, y + cell.row * cellSize, cellSize, PIECE_COLORS[ghost.type], 0.2)
    })
    pieceCells(this.state.active).forEach((cell) => {
      if (cell.row >= 0) this.drawBlock(graphics, x + cell.column * cellSize, y + cell.row * cellSize, cellSize, PIECE_COLORS[this.state.active.type], 1)
    })
  }

  private drawBlock(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number, alpha: number): void {
    graphics.fillStyle(color, alpha)
    graphics.fillRoundedRect(x + 1.5, y + 1.5, size - 3, size - 3, Math.max(2, size * 0.1))
    graphics.lineStyle(Math.max(1, size * 0.055), 0xffffff, alpha * 0.28)
    graphics.lineBetween(x + size * 0.16, y + size * 0.18, x + size * 0.78, y + size * 0.18)
  }

  private drawSidePanel(x: number, y: number, width: number, compact: boolean): void {
    const previewGraphics = this.addDynamic(this.add.graphics())
    const fontSize = compact ? '15px' : '18px'
    const stats = compact
      ? `得分 ${this.state.score}\n最高 ${this.bestScore}\n消行 ${this.state.lines}\n等级 ${this.state.level}`
      : `得分\n${this.state.score}\n\n最高\n${this.bestScore}\n\n消行\n${this.state.lines}\n\n等级\n${this.state.level}`
    this.addDynamic(this.add.text(x, y, stats, {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize, fontStyle: 'bold', lineSpacing: compact ? 3 : 6
    }))

    const holdY = y + (compact ? 88 : 270)
    this.addDynamic(this.add.text(x, holdY, '暂存', {
      color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize, fontStyle: 'bold'
    }))
    const previewSize = Math.min(compact ? 18 : 23, width / 5)
    if (this.state.holdType) this.drawPreviewPiece(previewGraphics, this.state.holdType, x, holdY + 25, previewSize)

    const nextY = y + (compact ? 158 : 380)
    this.addDynamic(this.add.text(x, nextY, '接下来', {
      color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize, fontStyle: 'bold'
    }))
    const visibleQueue = compact ? this.state.nextQueue.slice(0, 1) : this.state.nextQueue
    visibleQueue.forEach((type, index) => {
      this.drawPreviewPiece(previewGraphics, type, x, nextY + 27 + index * 62, previewSize)
    })

    this.addDynamic(this.add.text(compact ? x + width - 52 : x, y + (compact ? 220 : 720), this.audio.isMuted ? '♪ 声音关' : '♫ 声音开', {
      color: '#698379', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: compact ? '14px' : '16px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.audio.toggleMuted()
      this.draw()
    }))
  }

  private drawPreviewPiece(graphics: Phaser.GameObjects.Graphics, type: PieceType, x: number, y: number, size: number): void {
    pieceCells({ type, rotation: 0, row: 0, column: 0 }).forEach((cell) => {
      this.drawBlock(graphics, x + cell.column * size, y + cell.row * size, size, PIECE_COLORS[type], 1)
    })
  }

  private drawControls(width: number, boardBottom: number, compact: boolean): void {
    const primary = [
      { text: '↺', action: () => this.apply(rotatePiece(this.state, -1), 'move') },
      { text: '←', action: () => this.apply(moveHorizontal(this.state, -1), 'move'), repeat: true },
      { text: '↓', action: () => this.apply(softDrop(this.state), 'soft'), repeat: true },
      { text: '→', action: () => this.apply(moveHorizontal(this.state, 1), 'move'), repeat: true }
    ] satisfies ControlButton[]
    const secondary = [
      { text: '暂存', action: () => this.applyHold() },
      { text: '直落', action: () => this.apply(hardDrop(this.state), 'drop') },
      { text: this.paused ? '继续' : '暂停', action: () => this.togglePause() }
    ] satisfies ControlButton[]
    const gap = compact ? 8 : 10
    const buttonHeight = compact ? 56 : 58
    const rowGap = compact ? 8 : 9
    const startY = boardBottom + (compact ? 7 : 12)

    this.drawControlRow(primary, width, startY, compact ? 112 : 132, buttonHeight, gap, compact)
    this.drawControlRow(secondary, width, startY + buttonHeight + rowGap, compact ? 148 : 176, buttonHeight, gap, compact)
  }

  private drawControlRow(
    buttons: ControlButton[],
    availableWidth: number,
    y: number,
    maximumWidth: number,
    buttonHeight: number,
    gap: number,
    compact: boolean
  ): void {
    const horizontalMargin = compact ? 12 : 18
    const buttonWidth = Math.min(
      maximumWidth,
      (availableWidth - horizontalMargin * 2 - gap * (buttons.length - 1)) / buttons.length
    )
    const totalWidth = buttons.length * buttonWidth + (buttons.length - 1) * gap
    const startX = (availableWidth - totalWidth) / 2 + buttonWidth / 2

    buttons.forEach((button, index) => {
      const container = this.add.container(startX + index * (buttonWidth + gap), y + buttonHeight / 2)
      const background = new Phaser.GameObjects.Graphics(this)
      background.fillStyle(0xffffff, 0.9)
      background.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 15)
      const label = new Phaser.GameObjects.Text(this, 0, 0, button.text, {
        color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
        fontSize: compact ? '21px' : '24px', fontStyle: 'bold'
      }).setOrigin(0.5)
      if (button.text === '暂停' || button.text === '继续') this.pauseButtonText = label
      container.add([background, label])
      container.setSize(buttonWidth, buttonHeight).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.triggerControl(button))
    })
  }

  private triggerControl(button: ControlButton): void {
    if (this.paused && button.text !== '继续' && button.text !== '暂停') return
    this.stopControlRepeat()
    button.action()
    if (!button.repeat || this.paused || this.state.gameOver) return

    this.repeatDelayTimer = this.time.delayedCall(230, () => {
      this.repeatDelayTimer = null
      this.repeatTimer = this.time.addEvent({
        delay: 75,
        loop: true,
        callback: () => {
          if (this.paused || this.state.gameOver) {
            this.stopControlRepeat()
            return
          }
          button.action()
        }
      })
    })
  }

  private stopControlRepeat(): void {
    this.repeatDelayTimer?.destroy()
    this.repeatTimer?.destroy()
    this.repeatDelayTimer = null
    this.repeatTimer = null
  }

  private drawLineFlash(geometry: BoardGeometry): void {
    const message = this.add.text(geometry.x + geometry.width / 2, geometry.y + geometry.height * 0.55, `消除 ${this.lineFlash} 行！`, {
      color: '#fff7c7', backgroundColor: '#cb6544',
      fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '24px', fontStyle: 'bold',
      padding: { x: 18, y: 10 }
    }).setOrigin(0.5)
    message.setScale(0.7)
    this.tweens.add({
      targets: message,
      scale: 1.08,
      alpha: 0,
      y: message.y - 45,
      duration: 650,
      ease: 'Back.Out',
      onComplete: () => message.destroy()
    })
  }

  private drawOverlay(geometry: BoardGeometry): void {
    const panel = this.addDynamic(this.add.container(geometry.x + geometry.width / 2, geometry.y + geometry.height / 2))
    const background = new Phaser.GameObjects.Graphics(this)
    background.fillStyle(0x173f35, 0.9)
    background.fillRoundedRect(-geometry.width * 0.42, -72, geometry.width * 0.84, 144, 20)
    const title = new Phaser.GameObjects.Text(this, 0, -25, this.state.gameOver ? '游戏结束' : '暂停一下', {
      color: '#fffaf0', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: `${Math.max(24, geometry.width * 0.095)}px`, fontStyle: 'bold'
    }).setOrigin(0.5)
    const action = new Phaser.GameObjects.Text(this, 0, 30, this.state.gameOver ? '再来一局' : '继续游戏', {
      color: '#173f35', backgroundColor: '#f8f1df',
      fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '17px', fontStyle: 'bold',
      padding: { x: 18, y: 9 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.state.gameOver ? this.restart() : this.togglePause())
    panel.add([background, title, action])
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
