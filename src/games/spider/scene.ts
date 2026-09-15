import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createCardSlot, createCardView } from '../cards/card-view'
import {
  dealStock,
  moveSequence,
  movableSequenceLength,
  newGame,
  type SpiderSuitCount,
  type SpiderMoveResult,
  type SpiderState
} from './core/game'

interface SceneCallbacks {
  onExit: () => void
  onStateChange: (state: SpiderState, initialDeal: SpiderState) => void
}
interface Selection { column: number; start: number }

const CARD_WIDTH = 82
const CARD_HEIGHT = 112
const COLUMN_X = 25
const COLUMN_GAP = 18
const TABLEAU_Y = 185

export class SpiderScene extends Phaser.Scene {
  private state: SpiderState
  private initialDeal: SpiderState
  private history: SpiderState[] = []
  private selection: Selection | null = null
  private hintMessage = ''
  private completedFlash = 0
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks

  constructor(audio: GameAudio, callbacks: SceneCallbacks, initialState = newGame(), initialDeal = initialState) {
    super({ key: 'spider' })
    this.audio = audio
    this.callbacks = callbacks
    this.state = initialState
    this.initialDeal = initialDeal
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
    this.createHeaderAction(690, '提示', () => this.showHint())
    this.createHeaderAction(780, '撤销', () => this.undo(), this.history.length > 0)
    this.createHeaderAction(890, '重开本局', () => this.restartDeal())
    this.createHeaderAction(1000, '新牌局', () => this.newDeal(), true, 1)
    this.add.text(145, 20, this.audio.isMuted ? '♪ 声音关' : '♫ 声音开', {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '15px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', () => { this.audio.toggleMuted(); this.draw() })
    this.add.text(300, 57, `得分 ${this.state.score} · 移动 ${this.state.moves} 次${this.hintMessage ? ` · ${this.hintMessage}` : ''}`, {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '16px'
    }).setOrigin(0.5, 0)
    this.createDifficultyButton(635, 66, 1, '一花色')
    this.createDifficultyButton(760, 66, 2, '两花色')
    this.createDifficultyButton(885, 66, 4, '四花色')
  }

  private createHeaderAction(x: number, label: string, action: () => void, enabled = true, originX = 0.5): void {
    this.add.text(x, 18, label, {
      color: enabled ? '#ffd47b' : '#78968a', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: '17px', fontStyle: 'bold'
    }).setOrigin(originX, 0).setInteractive({ useHandCursor: enabled }).on('pointerup', () => {
      if (enabled) action()
    })
  }

  private createDifficultyButton(x: number, y: number, suitCount: SpiderSuitCount, label: string): void {
    const active = this.state.suitCount === suitCount
    this.add.text(x, y, label, {
      color: active ? '#173f35' : '#d7e7df', backgroundColor: active ? '#ffd47b' : '#527267',
      fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '14px', fontStyle: 'bold',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.changeDifficulty(suitCount))
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
    this.hintMessage = ''
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
      this.history.push(this.state)
      this.state = result.state
      this.hintMessage = ''
      this.callbacks.onStateChange(this.state, this.initialDeal)
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

  private undo(): void {
    const previous = this.history.pop()
    if (!previous) return
    this.state = previous
    this.selection = null
    this.hintMessage = '已撤销'
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.audio.playMove()
    this.draw()
  }

  private restartDeal(): void {
    this.state = this.initialDeal
    this.history = []
    this.selection = null
    this.hintMessage = '已重开同一牌局'
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.audio.playRestart()
    this.draw()
  }

  private newDeal(suitCount = this.state.suitCount): void {
    this.state = newGame(suitCount)
    this.initialDeal = this.state
    this.history = []
    this.selection = null
    this.hintMessage = ''
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.audio.playRestart()
    this.draw()
  }

  private changeDifficulty(suitCount: SpiderSuitCount): void {
    if (suitCount !== this.state.suitCount) this.newDeal(suitCount)
  }

  private showHint(): void {
    let fallback: { selection: Selection; target: number } | null = null
    for (let column = 0; column < this.state.tableau.length; column += 1) {
      const cards = this.state.tableau[column] ?? []
      for (let start = 0; start < cards.length; start += 1) {
        if (movableSequenceLength(cards, start) === 0) continue
        for (let target = 0; target < this.state.tableau.length; target += 1) {
          if (!moveSequence(this.state, column, start, target).moved) continue
          const suggestion = { selection: { column, start }, target }
          if (start > 0 && !cards[start - 1]?.faceUp) {
            this.selection = suggestion.selection
            this.hintMessage = `移到第 ${target + 1} 列，翻开一张牌`
            this.draw()
            return
          }
          fallback ??= suggestion
        }
      }
    }
    if (fallback) {
      this.selection = fallback.selection
      this.hintMessage = `试试移到第 ${fallback.target + 1} 列`
    } else if (this.state.stock.length >= 10 && this.state.tableau.every((column) => column.length > 0)) {
      this.selection = null
      this.hintMessage = '可以点右上角牌堆发牌'
    } else {
      this.selection = null
      this.hintMessage = '先填满空列，再继续发牌'
    }
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
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.newDeal())
    panel.add([background, title, button])
  }
}
