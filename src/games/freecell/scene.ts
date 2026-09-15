import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createCardSlot, createCardView } from '../cards/card-view'
import { SUITS, suitSymbol, type Suit } from '../cards/core/cards'
import {
  moveFreeCellToFoundation,
  moveFreeCellToTableau,
  moveTableauToFoundation,
  moveTableauToFreeCell,
  moveTableauToTableau,
  movableSequenceLength,
  newGame,
  type FreeCellState,
  type MoveResult
} from './core/game'

interface SceneCallbacks { onExit: () => void }
type Selection =
  | { kind: 'tableau'; column: number; start: number; count: number }
  | { kind: 'freecell'; index: number }

const CARD_WIDTH = 100
const CARD_HEIGHT = 136
const COLUMN_GAP = 22
const TABLEAU_X = 35
const TABLEAU_Y = 238

export class FreeCellScene extends Phaser.Scene {
  private state: FreeCellState = newGame()
  private selection: Selection | null = null
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks

  constructor(audio: GameAudio, callbacks: SceneCallbacks) {
    super({ key: 'freecell' })
    this.audio = audio
    this.callbacks = callbacks
  }

  create(): void {
    this.input.on('pointerdown', () => void this.audio.unlock())
    this.draw()
  }

  private draw(): void {
    this.children.removeAll(true)
    this.cameras.main.setBackgroundColor('#23614f')
    this.drawHeader()
    this.drawTopSlots()
    this.drawTableau()
    if (this.state.won) this.drawWin()
  }

  private drawHeader(): void {
    this.add.text(24, 18, '‹ 游戏屋', {
      color: '#d7e7df', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '22px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', this.callbacks.onExit)
    this.add.text(512, 14, '空当接龙', {
      color: '#fffdf6', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '38px', fontStyle: 'bold'
    }).setOrigin(0.5, 0)
    this.add.text(1000, 20, '新游戏', {
      color: '#ffd47b', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '21px', fontStyle: 'bold'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())
    this.add.text(145, 22, this.audio.isMuted ? '♪ 声音关' : '♫ 声音开', {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '15px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.audio.toggleMuted()
      this.draw()
    })
    this.add.text(512, 60, `移动 ${this.state.moves} 次 · 先点牌，再点目标位置`, {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '16px'
    }).setOrigin(0.5, 0)
  }

  private drawTopSlots(): void {
    for (let index = 0; index < 4; index += 1) {
      const x = 40 + index * 112
      const card = this.state.freeCells[index]
      if (card) {
        createCardView(this, x, 92, CARD_WIDTH, CARD_HEIGHT * 0.82, card, {
          selected: this.selection?.kind === 'freecell' && this.selection.index === index,
          onSelect: () => this.selectFreeCell(index)
        })
      } else {
        createCardSlot(this, x, 92, CARD_WIDTH, CARD_HEIGHT * 0.82, '空', () => this.targetFreeCell(index))
      }
    }

    SUITS.forEach((suit, index) => {
      const x = 576 + index * 104
      const rank = this.state.foundations[suit]
      if (rank > 0) {
        const card = { id: `foundation-${suit}-${rank}`, suit, rank, color: suit === 'hearts' || suit === 'diamonds' ? 'red' as const : 'black' as const }
        createCardView(this, x, 92, 90, CARD_HEIGHT * 0.82, card, { onSelect: () => this.targetFoundation(suit) })
      } else {
        createCardSlot(this, x, 92, 90, CARD_HEIGHT * 0.82, suitSymbol(suit), () => this.targetFoundation(suit))
      }
    })
  }

  private drawTableau(): void {
    const longest = Math.max(...this.state.tableau.map((column) => column.length), 1)
    const overlap = Math.min(38, Math.max(22, (748 - TABLEAU_Y - CARD_HEIGHT) / Math.max(1, longest - 1)))
    this.state.tableau.forEach((column, columnIndex) => {
      const x = TABLEAU_X + columnIndex * (CARD_WIDTH + COLUMN_GAP)
      createCardSlot(this, x, TABLEAU_Y, CARD_WIDTH, CARD_HEIGHT, '', () => this.targetTableau(columnIndex))
      column.forEach((card, cardIndex) => {
        const selected = this.selection?.kind === 'tableau'
          && this.selection.column === columnIndex
          && cardIndex >= this.selection.start
        createCardView(this, x, TABLEAU_Y + cardIndex * overlap, CARD_WIDTH, CARD_HEIGHT, card, {
          selected,
          onSelect: () => this.selectTableau(columnIndex, cardIndex)
        }).setDepth(cardIndex + 1)
      })
    })
  }

  private selectTableau(column: number, start: number): void {
    if (this.selection) {
      if (this.selection.kind === 'tableau' && this.selection.column === column) {
        this.targetFoundation()
      } else {
        this.targetTableau(column)
      }
      return
    }
    const cards = this.state.tableau[column] ?? []
    const count = movableSequenceLength(cards, start)
    if (count > 0) this.selection = { kind: 'tableau', column, start, count }
    this.draw()
  }

  private selectFreeCell(index: number): void {
    if (this.selection) {
      this.targetFreeCell(index)
      return
    }
    if (this.state.freeCells[index]) this.selection = { kind: 'freecell', index }
    this.draw()
  }

  private targetTableau(column: number): void {
    if (!this.selection) return
    const result = this.selection.kind === 'tableau'
      ? moveTableauToTableau(this.state, this.selection.column, column, this.selection.count)
      : moveFreeCellToTableau(this.state, this.selection.index, column)
    this.finish(result)
  }

  private targetFreeCell(index: number): void {
    if (!this.selection || this.selection.kind !== 'tableau' || this.selection.count !== 1) return
    this.finish(moveTableauToFreeCell(this.state, this.selection.column, index))
  }

  private targetFoundation(_suit?: Suit): void {
    if (!this.selection) return
    const result = this.selection.kind === 'tableau'
      ? moveTableauToFoundation(this.state, this.selection.column)
      : moveFreeCellToFoundation(this.state, this.selection.index)
    this.finish(result)
  }

  private finish(result: MoveResult): void {
    if (result.moved) {
      this.state = result.state
      this.audio.playPlace(2)
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

  private drawWin(): void {
    const panel = this.add.container(512, 410).setDepth(500)
    const background = new Phaser.GameObjects.Graphics(this)
    background.fillStyle(0xfffdf6, 0.97)
    background.fillRoundedRect(-220, -100, 440, 200, 28)
    const title = new Phaser.GameObjects.Text(this, 0, -42, '全部回家啦！', {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '38px', fontStyle: 'bold'
    }).setOrigin(0.5)
    const button = new Phaser.GameObjects.Text(this, 0, 38, '再玩一局', {
      color: '#fffaf0', backgroundColor: '#cb6544', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: '20px', fontStyle: 'bold', padding: { x: 22, y: 11 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.restart())
    panel.add([background, title, button])
  }
}
