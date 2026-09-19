import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createPuzzleChrome, createSegmentControl, preloadGameUi } from '../../ui'
import { attachFirstRunHelp, showHelpPanel } from '../../ui/phaser/help'
import {
  BOARD_SIZE,
  chooseComputerMove,
  newGame,
  placeStone,
  type Player
} from './core/game'

type GameMode = 'computer' | 'two-player'

interface SceneCallbacks {
  onExit: () => void
}

interface BoardGeometry {
  x: number
  y: number
  size: number
  spacing: number
}

export class GomokuScene extends Phaser.Scene {
  private state = newGame()
  private mode: GameMode = 'computer'
  private wins: Record<Player, number> = { 1: 0, 2: 0 }
  private thinking = false
  private animateLastMove = false
  private geometry: BoardGeometry | null = null
  private pinchDist = 0
  private pinching = false
  private dragStart: { x: number; y: number } | null = null
  private lastDrag: { x: number; y: number } | null = null
  private dragged = false
  private boardLayer: Phaser.GameObjects.Container | null = null
  private boardCamera: Phaser.Cameras.Scene2D.Camera | null = null
  private boardZoom = 1
  private boardOffset = { x: 0, y: 0 }
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks

  constructor(audio: GameAudio, callbacks: SceneCallbacks) {
    super({ key: 'gomoku' })
    this.audio = audio
    this.callbacks = callbacks
  }

  preload(): void {
    preloadGameUi(this)
  }

  create(): void {
    attachFirstRunHelp(this, '五子棋')
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      void this.audio.unlock()
      if (!this.inBoardViewport(pointer.x, pointer.y)) return
      this.dragStart = { x: pointer.x, y: pointer.y }
      this.lastDrag = this.dragStart
      this.dragged = false
      this.handlePinch()
    })
    this.input.addPointer(1)
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.handlePinch()
      this.panWhenZoomed(pointer)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.handleBoardTap(pointer)
      if (!this.input.pointer1?.isDown && !this.input.pointer2?.isDown) this.resetGesture()
    })
    this.input.on('gameout', () => this.resetGesture())
    this.events.on(Phaser.Scenes.Events.PAUSE, () => this.resetGesture())
    const resize = (): void => { this.boardOffset = { x: 0, y: 0 }; this.resetGesture(); this.draw() }
    this.scale.on('resize', resize)
    const cleanup = (): void => {
      this.scale.off('resize', resize)
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup)
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanup)
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
    this.draw()
  }

  private resetGesture(): void {
    this.dragStart = null
    this.lastDrag = null
    this.dragged = false
    this.pinching = false
    this.pinchDist = 0
  }

  private inBoardViewport(x: number, y: number): boolean {
    const g = this.geometry
    return !!g && x >= g.x && y >= g.y && x <= g.x + g.size && y <= g.y + g.size
  }

  private applyBoardTransform(): void {
    const g = this.geometry
    if (!g || !this.boardLayer) return
    const limit = g.size * (this.boardZoom - 1) / 2
    this.boardOffset.x = Phaser.Math.Clamp(this.boardOffset.x, -limit, limit)
    this.boardOffset.y = Phaser.Math.Clamp(this.boardOffset.y, -limit, limit)
    this.boardLayer.setScale(this.boardZoom).setPosition(
      (g.x + g.size / 2) * (1 - this.boardZoom) + this.boardOffset.x,
      (g.y + g.size / 2) * (1 - this.boardZoom) + this.boardOffset.y
    )
  }

  private panWhenZoomed(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || this.pinching || !this.dragStart || !this.lastDrag) return
    if (Math.hypot(pointer.x - this.dragStart.x, pointer.y - this.dragStart.y) > 12) this.dragged = true
    if (this.boardZoom > 1 && this.dragged) {
      this.boardOffset.x += pointer.x - this.lastDrag.x
      this.boardOffset.y += pointer.y - this.lastDrag.y
      this.applyBoardTransform()
    }
    this.lastDrag = { x: pointer.x, y: pointer.y }
  }

  stepZoom(direction: 1 | -1): void {
    if (!this.sys.isActive()) return
    const steps = [1, 1.5, 2, 2.5]
    this.boardZoom = direction > 0
      ? steps.find(value => value > this.boardZoom + 0.001) ?? 2.5
      : [...steps].reverse().find(value => value < this.boardZoom - 0.001) ?? 1
    this.boardOffset = { x: 0, y: 0 }
    this.applyBoardTransform()
  }

  private handlePinch(): void {
    const p1 = this.input.pointer1
    const p2 = this.input.pointer2
    if (!p1?.isDown || !p2?.isDown || !this.boardLayer || !this.geometry) { this.pinchDist = 0; return }
    if (!this.inBoardViewport(p1.x, p1.y) || !this.inBoardViewport(p2.x, p2.y)) return
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y)
    if (!this.pinching || this.pinchDist <= 0) {
      this.pinching = true
      this.pinchDist = dist
      return
    }
    if (dist <= 0) return
    const midX = (p1.x + p2.x) / 2
    const midY = (p1.y + p2.y) / 2
    const local = this.boardLayer.getLocalPoint(midX, midY)
    this.boardZoom = Phaser.Math.Clamp(this.boardZoom * dist / this.pinchDist, 1, 2.5)
    const centerX = this.geometry.x + this.geometry.size / 2
    const centerY = this.geometry.y + this.geometry.size / 2
    this.boardOffset.x = midX - local.x * this.boardZoom - centerX * (1 - this.boardZoom)
    this.boardOffset.y = midY - local.y * this.boardZoom - centerY * (1 - this.boardZoom)
    this.applyBoardTransform()
    this.pinchDist = dist
  }

  private handleBoardTap(pointer: Phaser.Input.Pointer): void {
    if (this.pinching || this.dragged || !this.dragStart || !this.boardLayer) return
    if (Math.hypot(pointer.x - this.dragStart.x, pointer.y - this.dragStart.y) > 12) return
    if (!this.inBoardViewport(pointer.x, pointer.y)) return
    if (this.thinking || this.state.winner || this.state.draw) return
    if (this.mode === 'computer' && this.state.currentPlayer === 2) return
    const point = this.boardLayer.getLocalPoint(pointer.x, pointer.y)
    const index = this.pointerToIndex(point.x, point.y)
    if (index !== null) this.playTurn(index)
  }

  private playTurn(index: number): void {
    const player = this.state.currentPlayer
    const result = placeStone(this.state, index)
    if (!result.placed) return

    this.state = result.state
    this.animateLastMove = true
    this.audio.playPlace(player)
    this.finishTurn(player)

    if (
      this.mode === 'computer'
      && this.state.currentPlayer === 2
      && !this.state.winner
      && !this.state.draw
    ) {
      this.thinking = true
      this.draw()
      this.time.delayedCall(320, () => this.playComputerTurn())
    } else {
      this.draw()
    }
  }

  private playComputerTurn(): void {
    if (!this.thinking || this.state.winner || this.state.draw) return
    const index = chooseComputerMove(this.state.board, 2)
    this.thinking = false
    if (index === null) {
      this.draw()
      return
    }
    this.playTurn(index)
  }

  private finishTurn(player: Player): void {
    if (this.state.winner === player) {
      this.wins[player] += 1
      this.audio.playWin()
    } else if (this.state.draw) {
      this.audio.playGameOver()
    }
  }

  private restart(): void {
    this.boardZoom = 1
    this.boardOffset = { x: 0, y: 0 }
    this.resetGesture()
    this.thinking = false
    this.state = newGame()
    this.animateLastMove = false
    this.audio.playRestart()
    this.draw()
  }

  private setMode(mode: GameMode): void {
    if (this.mode === mode) return
    this.mode = mode
    // 模式含义不同（你/电脑 vs 黑/白），切换时清空本局比分
    this.wins = { 1: 0, 2: 0 }
    this.restart()
  }

  private draw(): void {
    this.tweens.killAll()
    this.children.removeAll(true)
    this.boardLayer = null
    const width = this.scale.width
    const height = this.scale.height
    const compact = height < 650
    const margin = Math.max(14, Math.min(28, width * 0.035))
    // 共享顶栏（topY 70 + 状态胶囊 142 + 模式分段 200）的统一头部高度。
    const headerHeight = 240
    const boardSize = Math.min(width - margin * 2, height - headerHeight - margin, 760)
    const boardX = (width - boardSize) / 2
    const boardY = headerHeight + Math.max(0, (height - headerHeight - boardSize) / 2)
    const spacing = boardSize / (BOARD_SIZE + 1)
    this.geometry = { x: boardX, y: boardY, size: boardSize, spacing }

    this.cameras.main.setBackgroundColor('#f8f1df')
    this.drawHeader(width, compact, margin)
    // Phaser 4 的 GeometryMask 仅用于 Canvas；WebGL 用独立 camera viewport 裁剪。
    // 相机保持 1 倍，只有棋盘容器变换，因此结算面板和顶栏均保持屏幕尺寸。
    this.boardLayer = this.add.container(0, 0)
    this.drawBoard(this.geometry)
    this.applyBoardTransform()
    const result = this.state.winner || this.state.draw ? this.drawResult(this.geometry) : null
    this.boardCamera ??= this.cameras.add(boardX, boardY, boardSize, boardSize)
    this.boardCamera.setViewport(boardX, boardY, boardSize, boardSize).setScroll(boardX, boardY)
    this.cameras.main.ignore(this.boardLayer)
    if (result) this.cameras.main.ignore(result)
    this.boardCamera.ignore(this.children.list.filter(object => object !== this.boardLayer && object !== result))
    this.animateLastMove = false
  }

  private drawHeader(width: number, compact: boolean, margin: number): void {
    const chrome = createPuzzleChrome(this, {
      title: '五子棋',
      audio: this.audio,
      onBack: this.callbacks.onExit,
      onHelp: () => showHelpPanel(this, '五子棋'),
      tools: [
        { icon: 'restart', label: '重开', action: () => this.restart() }
      ]
    })
    chrome.setStatus(`${this.scoreLabel()} · ${this.statusText()}`)
    chrome.layout(width, this.scale.height)

    const narrow = width < 560
    const mode = createSegmentControl(this, {
      items: [
        { value: 'computer' as const, label: '和电脑玩' },
        { value: 'two-player' as const, label: '双人对战' }
      ],
      value: this.mode,
      width: 224,
      height: compact ? 40 : 44,
      onChange: value => this.setMode(value)
    })
    mode.setPosition(narrow ? width / 2 : margin + 112, narrow ? 200 : compact ? 190 : 200)
  }

  private scoreLabel(): string {
    return this.mode === 'computer'
      ? `你 ${this.wins[1]} : ${this.wins[2]} 电脑`
      : `黑 ${this.wins[1]} : ${this.wins[2]} 白`
  }

  private drawBoard(geometry: BoardGeometry): void {
    const { x, y, size, spacing } = geometry
    const graphics = this.add.graphics()
    this.boardLayer?.add(graphics)
    graphics.fillStyle(0xd9aa63, 1)
    graphics.fillRoundedRect(x, y, size, size, spacing * 0.28)

    graphics.lineStyle(Math.max(1, spacing * 0.035), 0x6f4b2d, 0.72)
    for (let line = 1; line <= BOARD_SIZE; line += 1) {
      const offset = line * spacing
      graphics.lineBetween(x + spacing, y + offset, x + BOARD_SIZE * spacing, y + offset)
      graphics.lineBetween(x + offset, y + spacing, x + offset, y + BOARD_SIZE * spacing)
    }

    const starPoints = [3, 7, 11]
    graphics.fillStyle(0x6f4b2d, 1)
    starPoints.forEach((row) => starPoints.forEach((column) => {
      graphics.fillCircle(x + (column + 1) * spacing, y + (row + 1) * spacing, spacing * 0.075)
    }))

    this.state.board.forEach((cell, index) => {
      if (cell === 0) return
      this.drawStone(index, cell, geometry)
    })

    if (this.state.winningLine.length >= 5) {
      // 胜利连线从第一子生长到最后一子，让「赢」有一个明确的过程感。
      const first = this.pointForIndex(this.state.winningLine[0] ?? 0, geometry)
      const last = this.pointForIndex(this.state.winningLine.at(-1) ?? 0, geometry)
      const dx = last.x - first.x, dy = last.y - first.y
      const bar = this.add.rectangle(first.x, first.y, 0, Math.max(3, spacing * 0.12), 0xe25037, 0.88)
      this.boardLayer?.add(bar)
      bar.setOrigin(0, 0.5).setRotation(Math.atan2(dy, dx))
      this.tweens.add({ targets: bar, width: Math.hypot(dx, dy), duration: 340, ease: 'Cubic.Out' })
    }
  }

  private drawStone(index: number, player: Player, geometry: BoardGeometry): void {
    const point = this.pointForIndex(index, geometry)
    const radius = geometry.spacing * 0.41
    const stone = this.add.container(point.x, point.y)
    this.boardLayer?.add(stone)
    const shadow = new Phaser.GameObjects.Graphics(this)
    shadow.fillStyle(0x4a3425, 0.2)
    shadow.fillCircle(radius * 0.12, radius * 0.18, radius * 1.02)
    const disc = new Phaser.GameObjects.Graphics(this)
    disc.fillStyle(player === 1 ? 0x26302d : 0xfffbec, 1)
    disc.fillCircle(0, 0, radius)
    disc.lineStyle(Math.max(1, radius * 0.07), player === 1 ? 0x101716 : 0xc9bfa9, 1)
    disc.strokeCircle(0, 0, radius)
    stone.add([shadow, disc])

    if (index === this.state.lastMove) {
      const marker = new Phaser.GameObjects.Graphics(this)
      marker.fillStyle(0xe25037, 1)
      marker.fillCircle(0, 0, radius * 0.16)
      stone.add(marker)
      if (this.animateLastMove) {
        stone.setScale(0.35)
        this.tweens.add({ targets: stone, scale: 1, duration: 210, ease: 'Back.Out' })
      }
    }
  }

  private drawResult(geometry: BoardGeometry): Phaser.GameObjects.Container {
    const message = this.state.draw
      ? '这一局打成平手'
      : this.state.winner === 1
        ? (this.mode === 'computer' ? '你赢啦！' : '黑棋获胜！')
        : (this.mode === 'computer' ? '电脑赢了，再来一局吧' : '白棋获胜！')
    const panel = this.add.container(geometry.x + geometry.size / 2, geometry.y + geometry.size / 2)
    const background = new Phaser.GameObjects.Graphics(this)
    background.fillStyle(0xf8f1df, 0.94)
    background.fillRoundedRect(-geometry.size * 0.3, -70, geometry.size * 0.6, 140, 24)
    const title = new Phaser.GameObjects.Text(this, 0, -22, message, {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: `${Math.max(22, geometry.size * 0.043)}px`, fontStyle: 'bold'
    }).setOrigin(0.5)
    const button = new Phaser.GameObjects.Text(this, 0, 30, '再来一局', {
      color: '#fffaf0', backgroundColor: '#cb6544',
      fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '18px', fontStyle: 'bold',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())
    panel.add([background, title, button])
    panel.setScale(0.86)
    this.tweens.add({ targets: panel, scale: 1, duration: 240, ease: 'Back.Out' })
    return panel
  }

  private pointerToIndex(pointerX: number, pointerY: number): number | null {
    if (!this.geometry) return null
    const { x, y, spacing } = this.geometry
    const column = Math.round((pointerX - x) / spacing) - 1
    const row = Math.round((pointerY - y) / spacing) - 1
    if (row < 0 || row >= BOARD_SIZE || column < 0 || column >= BOARD_SIZE) return null
    const pointX = x + (column + 1) * spacing
    const pointY = y + (row + 1) * spacing
    if (Math.hypot(pointerX - pointX, pointerY - pointY) > spacing * 0.48) return null
    return row * BOARD_SIZE + column
  }

  private pointForIndex(index: number, geometry: BoardGeometry): Phaser.Math.Vector2 {
    const row = Math.floor(index / BOARD_SIZE)
    const column = index % BOARD_SIZE
    return new Phaser.Math.Vector2(
      geometry.x + (column + 1) * geometry.spacing,
      geometry.y + (row + 1) * geometry.spacing
    )
  }

  private statusText(): string {
    if (this.state.winner || this.state.draw) return '本局结束'
    if (this.thinking) return '电脑正在想…'
    if (this.mode === 'computer') return this.state.currentPlayer === 1 ? '轮到你下黑棋' : '轮到电脑'
    return this.state.currentPlayer === 1 ? '轮到黑棋' : '轮到白棋'
  }
}
