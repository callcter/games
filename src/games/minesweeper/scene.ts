import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { hasPrecisePointer } from '../../platform/input/pointer-capability'
import {
  chordCell,
  newGame,
  remainingMines,
  revealCell,
  toggleFlag,
  type MinesweeperState
} from './core/game'

interface SceneCallbacks { onExit: () => void }
type PlayMode = 'reveal' | 'flag'
type Difficulty = 'beginner' | 'intermediate' | 'expert'

const BOARD_SIZE = 704
const BOARD_X = 32
const BOARD_Y = 244
const NUMBER_COLORS = ['#4264a6', '#31805b', '#c24f46', '#6c4ba0', '#9e3d38', '#237d80', '#463f3a', '#77706a']

export class MinesweeperScene extends Phaser.Scene {
  private state: MinesweeperState = newGame()
  private difficulty: Difficulty = 'beginner'
  private mode: PlayMode = 'reveal'
  private elapsedSeconds = 0
  private timer?: Phaser.Time.TimerEvent
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks

  constructor(audio: GameAudio, callbacks: SceneCallbacks) {
    super({ key: 'minesweeper' })
    this.audio = audio
    this.callbacks = callbacks
  }

  create(): void {
    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', () => void this.audio.unlock())
    this.timer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.state.status !== 'playing') return
        this.elapsedSeconds = Math.min(999, this.elapsedSeconds + 1)
        this.draw()
      }
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.timer?.destroy())
    this.draw()
  }

  private draw(): void {
    this.children.removeAll(true)
    this.cameras.main.setBackgroundColor('#e9dfca')
    this.drawHeader()
    this.drawStatus()
    this.drawBoard()
    this.drawControls()
    if (this.state.status === 'won' || this.state.status === 'lost') this.drawResult()
  }

  private drawHeader(): void {
    this.add.text(28, 24, '‹ 游戏屋', {
      color: '#50655d', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '22px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', this.callbacks.onExit)
    this.add.text(384, 18, '扫雷', {
      color: '#344b43', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '40px', fontStyle: 'bold'
    }).setOrigin(0.5, 0)
    this.add.text(740, 27, this.audio.isMuted ? '♪ 关' : '♫ 开', {
      color: '#73857e', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '18px', fontStyle: 'bold'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.audio.toggleMuted()
      this.draw()
    })

    this.createChoiceButton(225, 88, 126, 42, '初级 9×9', this.difficulty === 'beginner', () => this.changeDifficulty('beginner'))
    this.createChoiceButton(384, 88, 146, 42, '中级 16×16', this.difficulty === 'intermediate', () => this.changeDifficulty('intermediate'))
    this.createChoiceButton(553, 88, 152, 42, '高级 30×16', this.difficulty === 'expert', () => this.changeDifficulty('expert'))
  }

  private drawStatus(): void {
    this.add.text(36, 158, `⚑ ${remainingMines(this.state)}`, {
      color: '#fffaf0', backgroundColor: '#c65f4b', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: '28px', fontStyle: 'bold', padding: { x: 16, y: 8 }
    })
    this.add.text(384, 158, this.state.status === 'lost' ? '😵' : this.state.status === 'won' ? '😎' : '🙂', {
      color: '#344b43', fontSize: '38px'
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())
    this.add.text(732, 158, `◷ ${String(this.elapsedSeconds).padStart(3, '0')}`, {
      color: '#fffaf0', backgroundColor: '#506b61', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: '28px', fontStyle: 'bold', padding: { x: 16, y: 8 }
    }).setOrigin(1, 0)
  }

  private drawBoard(): void {
    const cellSize = BOARD_SIZE / this.state.width
    const boardHeight = cellSize * this.state.height
    const frame = this.add.graphics()
    frame.fillStyle(0x9a8e79, 1)
    frame.fillRoundedRect(BOARD_X - 8, BOARD_Y - 8, BOARD_SIZE + 16, boardHeight + 16, 12)

    this.state.cells.forEach((cell, index) => {
      const column = index % this.state.width
      const row = Math.floor(index / this.state.width)
      const x = BOARD_X + column * cellSize
      const y = BOARD_Y + row * cellSize
      const tile = this.add.rectangle(
        x + cellSize / 2,
        y + cellSize / 2,
        cellSize - 2,
        cellSize - 2,
        cell.visibility === 'revealed' ? 0xf2eadb : 0x769b83
      ).setInteractive({ useHandCursor: true })

      if (cell.visibility !== 'revealed') {
        tile.setStrokeStyle(Math.max(1, cellSize * 0.045), 0xa7c0ad)
      } else {
        tile.setStrokeStyle(1, 0xd5c9b5)
      }
      tile.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.selectCell(index, pointer.button === 2))

      const fontSize = `${Math.floor(cellSize * 0.55)}px`
      if (cell.visibility === 'flagged') {
        this.add.text(x + cellSize / 2, y + cellSize / 2, '⚑', {
          color: '#ffe1a6', fontFamily: 'Arial, sans-serif', fontSize, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2)
      } else if (cell.visibility === 'revealed' && cell.mine) {
        const exploded = index === this.state.explodedIndex
        tile.setFillStyle(exploded ? 0xd95546 : 0xead9bf)
        this.add.circle(x + cellSize / 2, y + cellSize / 2, cellSize * 0.22, 0x343c39).setDepth(2)
        this.add.text(x + cellSize / 2, y + cellSize / 2, '✦', {
          color: '#f3c768', fontSize: `${Math.floor(cellSize * 0.28)}px`, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(3)
      } else if (cell.visibility === 'revealed' && cell.adjacent > 0) {
        this.add.text(x + cellSize / 2, y + cellSize / 2, String(cell.adjacent), {
          color: NUMBER_COLORS[cell.adjacent - 1] ?? '#463f3a',
          fontFamily: 'Avenir Next, Arial, sans-serif', fontSize, fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2)
      }
    })
  }

  private drawControls(): void {
    const y = 986
    this.createChoiceButton(220, y, 154, 54, '⛏  挖掘', this.mode === 'reveal', () => {
      this.mode = 'reveal'
      this.draw()
    })
    this.createChoiceButton(394, y, 154, 54, '⚑  插旗', this.mode === 'flag', () => {
      this.mode = 'flag'
      this.draw()
    })
    // 触屏环境不提示右键操作
    const hint = hasPrecisePointer() ? '点数字可展开周围 · 也可右键插旗' : '点数字可展开周围'
    this.add.text(384, 212, hint, {
      color: '#766f63', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '16px'
    }).setOrigin(0.5)
  }

  private createChoiceButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    selected: boolean,
    action: () => void
  ): void {
    const background = this.add.rectangle(x, y, width, height, selected ? 0xc65f4b : 0xd8cdbb)
      .setStrokeStyle(2, selected ? 0xa84b3c : 0xb8aa94)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', action)
    this.add.text(x, y, label, {
      color: selected ? '#fffaf0' : '#53635d', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: height > 45 ? '21px' : '17px', fontStyle: 'bold'
    }).setOrigin(0.5)
    background.setDepth(0)
  }

  private selectCell(index: number, rightClick: boolean): void {
    if (this.state.status === 'won' || this.state.status === 'lost') return
    const cell = this.state.cells[index]
    if (!cell) return
    const previousStatus = this.state.status
    const useFlag = rightClick || this.mode === 'flag'
    const result = useFlag
      ? toggleFlag(this.state, index)
      : cell.visibility === 'revealed'
        ? chordCell(this.state, index)
        : revealCell(this.state, index)
    if (!result.changed) return
    this.state = result.state
    if (useFlag) this.audio.playPlace(1)
    else this.audio.playMove()
    if (previousStatus !== this.state.status) {
      if (this.state.status === 'won') this.audio.playWin()
      if (this.state.status === 'lost') this.audio.playGameOver()
    }
    this.draw()
  }

  private changeDifficulty(difficulty: Difficulty): void {
    if (difficulty === this.difficulty) return
    this.difficulty = difficulty
    this.restart()
  }

  private restart(): void {
    this.state = this.difficulty === 'beginner'
      ? newGame(9, 9, 10)
      : this.difficulty === 'intermediate'
        ? newGame(16, 16, 40)
        : newGame(30, 16, 99)
    this.elapsedSeconds = 0
    this.mode = 'reveal'
    this.audio.playRestart()
    this.draw()
  }

  private drawResult(): void {
    const won = this.state.status === 'won'
    const panel = this.add.container(384, 570).setDepth(500)
    const background = new Phaser.GameObjects.Graphics(this)
    background.fillStyle(0xfffaf0, 0.97)
    background.fillRoundedRect(-205, -105, 410, 210, 28)
    background.lineStyle(4, won ? 0x68a47e : 0xc65f4b, 1)
    background.strokeRoundedRect(-205, -105, 410, 210, 28)
    const title = new Phaser.GameObjects.Text(this, 0, -48, won ? '雷区清空啦！' : '踩到地雷啦', {
      color: '#344b43', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '36px', fontStyle: 'bold'
    }).setOrigin(0.5)
    const subtitle = new Phaser.GameObjects.Text(this, 0, 2, won ? `用时 ${this.elapsedSeconds} 秒` : '记住位置，再试一次', {
      color: '#766f63', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '19px'
    }).setOrigin(0.5)
    const button = new Phaser.GameObjects.Text(this, 0, 62, '再玩一局', {
      color: '#fffaf0', backgroundColor: won ? '#568b6b' : '#c65f4b', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: '20px', fontStyle: 'bold', padding: { x: 24, y: 11 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())
    panel.add([background, title, subtitle, button])
  }
}
