import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createHeaderButton } from '../../platform/display/header-button'
import { createCardSlot, createCardView } from '../cards/card-view'
import { SUITS, rankLabel, suitSymbol, type Suit } from '../cards/core/cards'
import {
  canAutoFinish,
  moveFreeCellToFoundation,
  moveFreeCellToTableau,
  moveTableauToFoundation,
  moveTableauToFreeCell,
  moveTableauToTableau,
  maxMovableCards,
  movableSequenceLength,
  newGame,
  nextAutoMove,
  type FreeCellState,
  type MoveResult
} from './core/game'

interface SceneCallbacks {
  onExit: () => void
  onStateChange: (state: FreeCellState, initialDeal: FreeCellState) => void
}
type Selection =
  | { kind: 'tableau'; column: number; start: number; count: number }
  | { kind: 'freecell'; index: number }

const CARD_WIDTH = 100
const CARD_HEIGHT = 136
const COLUMN_GAP = 22
const TABLEAU_X = 35
const TABLEAU_Y = 238
const TABLEAU_BOTTOM = 748

export class FreeCellScene extends Phaser.Scene {
  private state: FreeCellState
  private initialDeal: FreeCellState
  private history: FreeCellState[] = []
  private selection: Selection | null = null
  private autoFinishing = false
  private hintMessage = '先点牌，再点目标位置'
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks

  constructor(audio: GameAudio, callbacks: SceneCallbacks, initialState = newGame(), initialDeal = initialState) {
    super({ key: 'freecell' })
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
    // 右对齐连续排布：新牌局 / 重开本局 / 撤销 / 提示（y28，与信息行拉开间隙）
    let actionRight = 1000
    actionRight -= createHeaderButton(this, { x: actionRight, y: 28, anchor: 'right', tone: 'dark', label: '新牌局', onTap: () => this.newDeal() }) + 10
    actionRight -= createHeaderButton(this, { x: actionRight, y: 28, anchor: 'right', tone: 'dark', label: '重开本局', onTap: () => this.restartDeal() }) + 10
    actionRight -= createHeaderButton(this, { x: actionRight, y: 28, anchor: 'right', tone: 'dark', label: '撤销', onTap: () => this.undo(), enabled: this.history.length > 0 }) + 10
    actionRight -= createHeaderButton(this, { x: actionRight, y: 28, anchor: 'right', tone: 'dark', label: '提示', onTap: () => this.showHint() })
    this.add.text(145, 22, this.audio.isMuted ? '♪ 声音关' : '♫ 声音开', {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '15px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.audio.toggleMuted()
      this.draw()
    })
    const gameLabel = this.state.gameNumber > 0 ? `第 ${this.state.gameNumber} 局 · ` : ''
    this.add.text(512, 60, `${gameLabel}移动 ${this.state.moves} 次 · ${this.hintMessage}`, {
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
      // 空列不只顶部牌框可点；整列空白都应能作为移动目标。
      this.add.zone(
        x + CARD_WIDTH / 2,
        TABLEAU_Y + (TABLEAU_BOTTOM - TABLEAU_Y) / 2,
        CARD_WIDTH,
        TABLEAU_BOTTOM - TABLEAU_Y
      ).setDepth(-1).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.targetTableau(columnIndex))
      createCardSlot(this, x, TABLEAU_Y, CARD_WIDTH, CARD_HEIGHT, '', () => this.targetTableau(columnIndex))
      column.forEach((card, cardIndex) => {
        const selected = this.selection?.kind === 'tableau'
          && this.selection.column === columnIndex
          && cardIndex >= this.selection.start
        createCardView(this, x + (selected ? 6 : 0), TABLEAU_Y + cardIndex * overlap, CARD_WIDTH, CARD_HEIGHT, card, {
          selected,
          onSelect: () => this.selectTableau(columnIndex, cardIndex)
        }).setDepth(cardIndex + 1)
      })
    })
  }

  private selectTableau(column: number, start: number): void {
    if (this.autoFinishing) return
    if (this.selection) {
      if (this.selection.kind === 'tableau' && this.selection.column === column) {
        if (this.selection.start === start) {
          this.selection = null
          this.hintMessage = '已取消选中'
          this.draw()
          return
        }
      } else {
        this.targetTableau(column)
        return
      }
    }
    const cards = this.state.tableau[column] ?? []
    const count = movableSequenceLength(cards, start)
    if (count > 0) {
      this.selection = { kind: 'tableau', column, start, count }
      const emptyTarget = this.state.tableau.findIndex((target, index) => target.length === 0 && index !== column)
      this.hintMessage = count > 1 && emptyTarget >= 0
        ? `已选 ${count} 张 · 放空列最多 ${maxMovableCards(this.state, emptyTarget)} 张`
        : count > 1
          ? `已选中 ${count} 张，点另一列移动`
          : '已选中 1 张，点目标位置'
    } else {
      this.selection = null
      this.hintMessage = '只能从红黑交替、逐张递减的牌开始选'
    }
    this.draw()
  }

  private selectFreeCell(index: number): void {
    if (this.autoFinishing) return
    this.hintMessage = '先点牌，再点目标位置'
    if (this.selection) {
      this.targetFreeCell(index)
      return
    }
    if (this.state.freeCells[index]) {
      this.selection = { kind: 'freecell', index }
      this.hintMessage = '已选中 1 张，点目标位置'
    }
    this.draw()
  }

  private targetTableau(column: number): void {
    if (this.autoFinishing) return
    if (!this.selection) return
    const targetIsEmpty = (this.state.tableau[column]?.length ?? 0) === 0
    const selectedCount = this.selection.kind === 'tableau' ? this.selection.count : 1
    const capacity = this.selection.kind === 'tableau' ? maxMovableCards(this.state, column) : 1
    const exceedsCapacity = selectedCount > capacity
    const result = this.selection.kind === 'tableau'
      ? moveTableauToTableau(this.state, this.selection.column, column, this.selection.count)
      : moveFreeCellToTableau(this.state, this.selection.index, column)
    this.finish(
      result,
      exceedsCapacity
        ? `选了 ${selectedCount} 张，最多移动 ${capacity} 张${targetIsEmpty ? '（目标空列不算中转）' : ''}`
        : targetIsEmpty
        ? '空列可以放牌，但一次可搬的张数受空当格和其他空列限制'
        : '这里要接颜色相反、点数大一号的牌'
    )
  }

  private targetFreeCell(index: number): void {
    if (this.autoFinishing || !this.selection) return
    if (this.selection.kind !== 'tableau' || this.selection.count !== 1) {
      this.hintMessage = '空当格一次只能放 1 张牌'
      this.draw()
      return
    }
    this.finish(moveTableauToFreeCell(this.state, this.selection.column, index), '这个空当格已经有牌了')
  }

  private targetFoundation(_suit?: Suit): void {
    if (this.autoFinishing || !this.selection) return
    const result = this.selection.kind === 'tableau'
      ? moveTableauToFoundation(this.state, this.selection.column)
      : moveFreeCellToFoundation(this.state, this.selection.index)
    this.finish(result, '右上角要从 A 开始，按同一花色依次收牌')
  }

  private finish(result: MoveResult, failureMessage: string): void {
    if (result.moved) {
      this.history.push(this.state)
      this.state = result.state
      this.hintMessage = '先点牌，再点目标位置'
      this.callbacks.onStateChange(this.state, this.initialDeal)
      this.audio.playPlace(2)
      if (this.state.won) this.audio.playWin()
      this.selection = null
    } else {
      this.hintMessage = failureMessage
    }
    this.draw()
    if (result.moved && !this.state.won) this.maybeAutoFinish()
  }

  /** 各列都已排成连续递减时，剩下的收牌没有悬念，自动替孩子收完。 */
  private maybeAutoFinish(): void {
    if (this.autoFinishing || !canAutoFinish(this.state)) return
    this.autoFinishing = true
    this.selection = null
    this.hintMessage = '牌都排好了，自动收回家～'
    this.draw()
    this.runAutoFinish()
  }

  private runAutoFinish(): void {
    const move = nextAutoMove(this.state)
    if (!move) {
      this.autoFinishing = false
      return
    }
    const result = move.source === 'tableau'
      ? moveTableauToFoundation(this.state, move.index)
      : moveFreeCellToFoundation(this.state, move.index)
    if (!result.moved) {
      this.autoFinishing = false
      return
    }
    this.history.push(this.state)
    this.state = result.state
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.audio.playPlace(2)
    if (this.state.won) {
      this.autoFinishing = false
      this.audio.playWin()
      this.draw()
      return
    }
    this.draw()
    this.time.delayedCall(130, () => this.runAutoFinish())
  }

  private undo(): void {
    if (this.autoFinishing) return
    const previous = this.history.pop()
    if (!previous) return
    this.state = previous
    this.selection = null
    this.hintMessage = '已撤销上一步'
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.audio.playMove()
    this.draw()
  }

  private restartDeal(): void {
    this.autoFinishing = false
    this.state = this.initialDeal
    this.history = []
    this.selection = null
    this.hintMessage = '已重开同一牌局'
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.audio.playRestart()
    this.draw()
  }

  private newDeal(): void {
    this.autoFinishing = false
    this.state = newGame()
    this.initialDeal = this.state
    this.history = []
    this.selection = null
    this.hintMessage = '新牌局已发好'
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.audio.playRestart()
    this.draw()
  }

  private showHint(): void {
    if (this.autoFinishing) return
    for (let index = 0; index < this.state.freeCells.length; index += 1) {
      const card = this.state.freeCells[index]
      if (card && moveFreeCellToFoundation(this.state, index).moved) {
        this.selection = { kind: 'freecell', index }
        this.hintMessage = `把 ${rankLabel(card.rank)}${suitSymbol(card.suit)} 收到右上角`
        this.draw()
        return
      }
    }
    for (let column = 0; column < this.state.tableau.length; column += 1) {
      const cards = this.state.tableau[column] ?? []
      const card = cards.at(-1)
      if (card && moveTableauToFoundation(this.state, column).moved) {
        this.selection = { kind: 'tableau', column, start: cards.length - 1, count: 1 }
        this.hintMessage = `把 ${rankLabel(card.rank)}${suitSymbol(card.suit)} 收到右上角`
        this.draw()
        return
      }
      for (let start = 0; start < cards.length; start += 1) {
        const count = movableSequenceLength(cards, start)
        if (count === 0) continue
        for (let target = 0; target < this.state.tableau.length; target += 1) {
          if (moveTableauToTableau(this.state, column, target, count).moved) {
            this.selection = { kind: 'tableau', column, start, count }
            this.hintMessage = `试试移到第 ${target + 1} 列`
            this.draw()
            return
          }
        }
      }
    }
    this.selection = null
    this.hintMessage = '暂时没找到明显步骤，试试利用左上角空当'
    this.draw()
  }

  private drawWin(): void {
    const panel = this.add.container(512, 410).setDepth(500)
    const background = new Phaser.GameObjects.Graphics(this)
    background.fillStyle(0xfffdf6, 0.97)
    background.fillRoundedRect(-220, -100, 440, 200, 28)
    const titleText = this.state.gameNumber > 0 ? `第 ${this.state.gameNumber} 局完成！` : '全部回家啦！'
    const title = new Phaser.GameObjects.Text(this, 0, -42, titleText, {
      color: '#173f35', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '38px', fontStyle: 'bold'
    }).setOrigin(0.5)
    const button = new Phaser.GameObjects.Text(this, 0, 38, '再玩一局', {
      color: '#fffaf0', backgroundColor: '#cb6544', fontFamily: 'Avenir Next, PingFang SC, sans-serif',
      fontSize: '20px', fontStyle: 'bold', padding: { x: 22, y: 11 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => this.newDeal())
    panel.add([background, title, button])
  }
}
