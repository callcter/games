import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createCardSlot, createCardView } from '../cards/card-view'
import {
  dealStock,
  moveSequence,
  movableSequenceLength,
  newGame,
  type SpiderMoveResult,
  type SpiderState
} from './core/game'

interface SceneCallbacks { onExit: () => void }
interface Selection { column: number; start: number }

const CARD_WIDTH = 82
const CARD_HEIGHT = 112
const COLUMN_X = 25
const COLUMN_GAP = 18
const TABLEAU_Y = 185

export class SpiderScene extends Phaser.Scene {
  private state: SpiderState = newGame()
  private selection: Selection | null = null
  private completedFlash = 0
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks

  constructor(audio: GameAudio, callbacks: SceneCallbacks) {
    super({ key: 'spider' })
    this.audio = audio
    this.callbacks = callbacks
  }

  create(): void {
    this.input.on('pointerdown', () => void this.audio.unlock())
    this.draw()
  }

  private draw(): void {
    this.tweens.killAll()
    this.children.removeAll(true)
    this.cameras.main.setBackgroundColor('#315b46')
    this.drawHeader()
    this.drawCompletedRuns()
    this.drawStock()
    this.drawTableau()
    if (this.completedFlash > 0) this.drawCompletedFlash()
    if (this.state.won) this.drawWin()
    this.completedFlash = 0
  }

  private drawHeader(): void {
    this.add.text(24, 16, '‹ 游戏屋', {
      color: '#d7e7df', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '22px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', this.callbacks.onExit)
    this.add.text(512, 12, '蜘蛛纸牌', {
      color: '#fffdf6', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '38px', fontStyle: 'bold'
    }).setOrigin(0.5, 0)
    this.add.text(1000, 18, '新游戏', {
      color: '#ffd47b', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '21px', fontStyle: 'bold'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())
    this.add.text(145, 20, this.audio.isMuted ? '♪ 声音关' : '♫ 声音开', {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '15px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', () => { this.audio.toggleMuted(); this.draw() })
    this.add.text(512, 57, `一花色 · 得分 ${this.state.score} · 移动 ${this.state.moves} 次`, {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '16px'
    }).setOrigin(0.5, 0)
  }

  private drawCompletedRuns(): void {
    for (let index = 0; index < 8; index += 1) {
      const x = 38 + index * 74
      const graphics = this.add.graphics()
      graphics.fillStyle(index < this.state.completedRuns ? 0xfffdf6 : 0xffffff, index < this.state.completedRuns ? 1 : 0.08)
      graphics.fillRoundedRect(x, 96, 58, 64, 8)
      graphics.lineStyle(1.5, 0xffffff, 0.25)
      graphics.strokeRoundedRect(x, 96, 58, 64, 8)
      if (index < this.state.completedRuns) {
        this.add.text(x + 29, 128, 'K\n♠\nA', {
          align: 'center', color: '#173f35', fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold'
        }).setOrigin(0.5)
      }
    }
  }

  private drawStock(): void {
    const remainingDeals = Math.floor(this.state.stock.length / 10)
    if (remainingDeals > 0) {
      const card = this.state.stock[0]
      if (card) createCardView(this, 900, 88, 76, 82, card, { faceUp: false, onSelect: () => this.deal() })
      this.add.text(938, 130, String(remainingDeals), {
        color: '#fffdf6', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '22px', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(5)
    } else {
      createCardSlot(this, 900, 88, 76, 82, '空', () => undefined)
    }
    this.add.text(938, 66, '发牌', {
      color: '#d7e7df', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '15px', fontStyle: 'bold'
    }).setOrigin(0.5)
  }

  private drawTableau(): void {
    const longest = Math.max(...this.state.tableau.map((column) => column.length), 1)
    const overlap = Math.min(29, Math.max(15, (750 - TABLEAU_Y - CARD_HEIGHT) / Math.max(1, longest - 1)))
    this.state.tableau.forEach((column, columnIndex) => {
      const x = COLUMN_X + columnIndex * (CARD_WIDTH + COLUMN_GAP)
      createCardSlot(this, x, TABLEAU_Y, CARD_WIDTH, CARD_HEIGHT, '', () => this.targetColumn(columnIndex))
      column.forEach((item, cardIndex) => {
        const y = TABLEAU_Y + cardIndex * overlap
        const selected = this.selection?.column === columnIndex && cardIndex >= this.selection.start
        createCardView(this, x, y, CARD_WIDTH, CARD_HEIGHT, item.card, {
          faceUp: item.faceUp,
          selected,
          onSelect: () => this.selectCard(columnIndex, cardIndex)
        }).setDepth(cardIndex + 1)
      })
    })
  }

  private selectCard(column: number, start: number): void {
    if (this.selection) {
      this.targetColumn(column)
      return
    }
    if (movableSequenceLength(this.state.tableau[column] ?? [], start) > 0) {
      this.selection = { column, start }
    }
    this.draw()
  }

  private targetColumn(column: number): void {
    if (!this.selection) return
    this.finish(moveSequence(this.state, this.selection.column, this.selection.start, column))
  }

  private deal(): void {
    if (this.selection) {
      this.selection = null
      this.draw()
      return
    }
    this.finish(dealStock(this.state))
  }

  private finish(result: SpiderMoveResult): void {
    if (result.moved) {
      this.state = result.state
      this.audio.playPlace(2)
      if (result.completed > 0) {
        this.completedFlash = result.completed
        this.audio.playMerge()
      }
      if (this.state.won) this.audio.playWin()
    }
    this.selection = null
    this.draw()
  }

  private restart(): void {
    this.state = newGame()
    this.selection = null
    this.audio.playRestart()
    this.draw()
  }

  private drawCompletedFlash(): void {
    const message = this.add.text(512, 390, this.completedFlash > 1 ? `收好 ${this.completedFlash} 组！` : '收好一组！', {
      color: '#173f35', backgroundColor: '#ffd47b', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: '28px', fontStyle: 'bold', padding: { x: 22, y: 12 }
    }).setOrigin(0.5).setDepth(400)
    message.setScale(0.7)
    this.tweens.add({ targets: message, scale: 1.08, alpha: 0, y: 330, duration: 750, ease: 'Back.Out' })
  }

  private drawWin(): void {
    const panel = this.add.container(512, 410).setDepth(500)
    const background = new Phaser.GameObjects.Graphics(this)
    background.fillStyle(0xfffdf6, 0.97)
    background.fillRoundedRect(-220, -100, 440, 200, 28)
    const title = new Phaser.GameObjects.Text(this, 0, -42, '蜘蛛网清空啦！', {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '36px', fontStyle: 'bold'
    }).setOrigin(0.5)
    const button = new Phaser.GameObjects.Text(this, 0, 38, '再玩一局', {
      color: '#fffaf0', backgroundColor: '#cb6544', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: '20px', fontStyle: 'bold', padding: { x: 22, y: 11 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())
    panel.add([background, title, button])
  }
}

