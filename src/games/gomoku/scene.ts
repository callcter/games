import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createLegacyChrome, createSegmentControl, preloadGameUi } from '../../ui'
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
      this.dragStart = { x: pointer.x, y: pointer.y }
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.handleBoardTap(pointer))
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.panWhenZoomed(pointer))
    // 手机 15 路盘格子约 22px：双指捏合或右侧 +/− 按钮放大后才能精确落子。
    this.input.addPointer(1)
    this.input.on('pointermove', () => this.handlePinch())
    this.input.on('pointerup', () => {
      if (!this.input.pointer1?.isDown && !this.input.pointer2?.isDown) {
        this.time.delayedCall(120, () => {
          if (!this.input.pointer1?.isDown && !this.input.pointer2?.isDown) this.pinching = false
        })
      }
    })
    this.scale.on('resize', () => this.draw())
    this.draw()
  }

  private panWhenZoomed(pointer: Phaser.Input.Pointer): void {
    const cam = this.cameras.main
    if (cam.zoom <= 1 || !pointer.isDown || this.pinching || !this.dragStart) return
    const dx = pointer.x - this.dragStart.x
    const dy = pointer.y - this.dragStart.y
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return
    const zoom = cam.zoom
    cam.setScroll(
      Phaser.Math.Clamp(cam.scrollX - dx / zoom, 0, this.scale.width - this.scale.width / zoom),
      Phaser.Math.Clamp(cam.scrollY - dy / zoom, 0, this.scale.height - this.scale.height / zoom)
    )
    this.dragStart = { x: pointer.x, y: pointer.y }
  }

  stepZoom(direction: 1 | -1): void {
    const cam = this.cameras.main
    const steps = [1, 1.5, 2, 2.5]
    const current = steps.indexOf(cam.zoom) >= 0 ? steps.indexOf(cam.zoom) : 0
    const next = Phaser.Math.Clamp(current + direction, 0, steps.length - 1)
    cam.setZoom(steps[next]!)
    if (steps[next] === 1) cam.setScroll(0, 0)
    else cam.centerOn(this.scale.width / 2, this.scale.height / 2)
  }

  private handlePinch(): void {
    const p1 = this.input.pointer1
    const p2 = this.input.pointer2
    if (!p1?.isDown || !p2?.isDown) { this.pinchDist = 0; return }
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y)
    if (!this.pinching || this.pinchDist <= 0) {
      this.pinching = true
      this.pinchDist = dist
      return
    }
    if (dist <= 0) return
    const midX = (p1.x + p2.x) / 2
    const midY = (p1.y + p2.y) / 2
    const cam = this.cameras.main
    const zoom = Phaser.Math.Clamp(cam.zoom * (dist / this.pinchDist), 1, 2.6)
    const world = cam.getWorldPoint(midX, midY)
    cam.setZoom(zoom)
    const scrollX = Phaser.Math.Clamp(world.x - midX / zoom, 0, this.scale.width - this.scale.width / zoom)
    const scrollY = Phaser.Math.Clamp(world.y - midY / zoom, 0, this.scale.height - this.scale.height / zoom)
    cam.setScroll(scrollX, scrollY)
    this.pinchDist = dist
  }

  private handleBoardTap(pointer: Phaser.Input.Pointer): void {
    if (this.pinching) return
    if (this.dragStart && Math.hypot(pointer.x - this.dragStart.x, pointer.y - this.dragStart.y) > 12) return
    if (this.thinking || this.state.winner || this.state.draw) return
    if (this.mode === 'computer' && this.state.currentPlayer === 2) return
    const index = this.pointerToIndex(pointer.worldX, pointer.worldY)
    if (index === null) return
    this.playTurn(index)
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
    this.cameras.main.setZoom(1).setScroll(0, 0)
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
    const width = this.scale.width
    const height = this.scale.height
    const compact = height < 650
    const margin = Math.max(14, Math.min(28, width * 0.035))
    const headerHeight = compact ? 88 : 142
    const boardSize = Math.min(width - margin * 2, height - headerHeight - margin, 760)
    const boardX = (width - boardSize) / 2
    const boardY = headerHeight + Math.max(0, (height - headerHeight - boardSize) / 2)
    const spacing = boardSize / (BOARD_SIZE + 1)
    this.geometry = { x: boardX, y: boardY, size: boardSize, spacing }

    this.cameras.main.setBackgroundColor('#f8f1df')
    this.drawHeader(width, compact, margin)
    this.drawBoard(this.geometry)
    if (this.state.winner || this.state.draw) this.drawResult(this.geometry)
    this.animateLastMove = false
  }

  private drawHeader(width: number, compact: boolean, margin: number): void {
    const chrome = createLegacyChrome(this, {
      width,
      title: '五子棋',
      audio: this.audio,
      onBack: this.callbacks.onExit,
      y: compact ? 34 : 46,
      tools: [
        { icon: 'hint', label: '规则', action: () => showHelpPanel(this, '五子棋') },
        { icon: 'restart', label: '重开', action: () => this.restart() }
      ]
    })
    // 双指/按钮缩放棋盘时顶栏钉在屏幕上
    chrome.container.setScrollFactor(0)

    const status = `${this.scoreLabel()} · ${this.statusText()}`
    this.add.text(width / 2, compact ? 55 : 88, status, {
      color: '#527267', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: compact ? '14px' : '18px', fontStyle: 'bold'
    }).setOrigin(0.5, 0).setScrollFactor(0)

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
    mode.setPosition(margin + 112, compact ? 72 : 98)
    mode.container.setScrollFactor(0)


  }

  private scoreLabel(): string {
    return this.mode === 'computer'
      ? `你 ${this.wins[1]} : ${this.wins[2]} 电脑`
      : `黑 ${this.wins[1]} : ${this.wins[2]} 白`
  }

  private drawBoard(geometry: BoardGeometry): void {
    const { x, y, size, spacing } = geometry
    const graphics = this.add.graphics()
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
      bar.setOrigin(0, 0.5).setRotation(Math.atan2(dy, dx))
      this.tweens.add({ targets: bar, width: Math.hypot(dx, dy), duration: 340, ease: 'Cubic.Out' })
    }
  }

  private drawStone(index: number, player: Player, geometry: BoardGeometry): void {
    const point = this.pointForIndex(index, geometry)
    const radius = geometry.spacing * 0.41
    const stone = this.add.container(point.x, point.y)
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

  private drawResult(geometry: BoardGeometry): void {
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
