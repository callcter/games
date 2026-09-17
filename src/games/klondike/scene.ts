import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createHeaderButton } from '../../platform/display/header-button'
import { createCardSlot, createCardView } from '../cards/card-view'
import { SUITS, suitSymbol, type Suit } from '../cards/core/cards'
import { draw, newDeal, nextAutoMove, playColumn, playWaste, recall, stuck, type KlondikeState } from './core/game'

interface SceneCallbacks {
  onExit: () => void
  onStateChange: (state: KlondikeState, initialDeal: KlondikeState) => void
}

type Selection =
  | { kind: 'waste' }
  | { kind: 'column'; column: number; start: number }
  | { kind: 'foundation'; suit: Suit }

const CARD_WIDTH = 100
const CARD_HEIGHT = 136
const COLUMN_GAP = 22
const TABLEAU_X = 35
const TABLEAU_Y = 252
const TABLEAU_BOTTOM = 748
const TOP_Y = 92

export class KlondikeScene extends Phaser.Scene {
  private state: KlondikeState
  private initialDeal: KlondikeState
  private history: KlondikeState[] = []
  private selection: Selection | null = null
  private autoFinishing = false
  private hintMessage = '先点亮着的牌，再点目标位置'
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks

  constructor(audio: GameAudio, callbacks: SceneCallbacks, initialState = newDeal(), initialDeal = initialState) {
    super({ key: 'klondike' })
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
    this.drawPiles()
    this.drawTableau()
    if (this.state.won) this.drawWin()
  }

  private drawHeader(): void {
    this.add.text(24, 18, '‹ 游戏屋', {
      color: '#d7e7df', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '22px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', this.callbacks.onExit)
    this.add.text(512, 14, '纸牌', {
      color: '#fffdf6', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '38px', fontStyle: 'bold'
    }).setOrigin(0.5, 0)
    let actionRight = 1000
    actionRight -= createHeaderButton(this, { x: actionRight, y: 28, anchor: 'right', tone: 'dark', label: '新牌局', onTap: () => this.newDeal() }) + 10
    actionRight -= createHeaderButton(this, { x: actionRight, y: 28, anchor: 'right', tone: 'dark', label: '重开本局', onTap: () => this.restartDeal() }) + 10
    actionRight -= createHeaderButton(this, { x: actionRight, y: 28, anchor: 'right', tone: 'dark', label: '撤销', onTap: () => this.undo(), enabled: this.history.length > 0 }) + 10
    actionRight -= createHeaderButton(this, { x: actionRight, y: 28, anchor: 'right', tone: 'dark', label: '翻一张', onTap: () => this.deal() })
    this.add.text(145, 22, this.audio.isMuted ? '♪ 声音关' : '♫ 声音开', {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '15px', fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.audio.toggleMuted()
      this.draw()
    })
    this.add.text(512, 60, `移动 ${this.state.moves} 次 · ${this.hintMessage}`, {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '16px'
    }).setOrigin(0.5, 0)
  }

  /** 左上翻牌堆/废牌堆，右上四个基础堆。 */
  private drawPiles(): void {
    if (this.state.stock.length) {
      createCardView(this, 35, TOP_Y, CARD_WIDTH, CARD_HEIGHT * 0.82, { id: 'stock', suit: 'spades', rank: 0, color: 'black' }, {
        faceUp: false,
        onSelect: () => this.deal()
      })
      this.add.text(85, TOP_Y + CARD_HEIGHT * 0.82 + 6, `剩 ${this.state.stock.length}`, {
        color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '13px'
      }).setOrigin(0.5, 0)
    } else {
      createCardSlot(this, 35, TOP_Y, CARD_WIDTH, CARD_HEIGHT * 0.82, '↻', () => this.deal())
      this.add.text(85, TOP_Y + CARD_HEIGHT * 0.82 + 6, '翻回重洗', {
        color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '13px'
      }).setOrigin(0.5, 0)
    }
    const wasteTop = this.state.waste[this.state.waste.length - 1]
    if (wasteTop) {
      createCardView(this, 157, TOP_Y, CARD_WIDTH, CARD_HEIGHT * 0.82, wasteTop, {
        selected: this.selection?.kind === 'waste',
        onSelect: () => this.selectWaste()
      })
    } else {
      createCardSlot(this, 157, TOP_Y, CARD_WIDTH, CARD_HEIGHT * 0.82, '', () => this.selectWaste())
    }
    SUITS.forEach((suit, index) => {
      const x = 576 + index * 104
      const rank = this.state.foundations[suit]
      if (rank > 0) {
        createCardView(this, x, TOP_Y, 90, CARD_HEIGHT * 0.82, { id: `f-${suit}-${rank}`, suit, rank, color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black' }, {
          selected: this.selection?.kind === 'foundation' && this.selection.suit === suit,
          onSelect: () => this.selectFoundation(suit)
        })
      } else {
        createCardSlot(this, x, TOP_Y, 90, CARD_HEIGHT * 0.82, suitSymbol(suit), () => this.targetFoundation(suit))
      }
    })
  }

  private drawTableau(): void {
    const longest = Math.max(...this.state.columns.map(column => column.hidden.length + column.up.length), 1)
    const overlap = Math.min(34, Math.max(18, (TABLEAU_BOTTOM - TABLEAU_Y - CARD_HEIGHT) / Math.max(1, longest - 1)))
    const hiddenOverlap = Math.min(overlap, 16)
    this.state.columns.forEach((column, columnIndex) => {
      const x = TABLEAU_X + columnIndex * (CARD_WIDTH + COLUMN_GAP)
      this.add.zone(x + CARD_WIDTH / 2, TABLEAU_Y + (TABLEAU_BOTTOM - TABLEAU_Y) / 2, CARD_WIDTH, TABLEAU_BOTTOM - TABLEAU_Y)
        .setDepth(-1).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.targetTableau(columnIndex))
      createCardSlot(this, x, TABLEAU_Y, CARD_WIDTH, CARD_HEIGHT, '', () => this.targetTableau(columnIndex))
      let y = TABLEAU_Y
      column.hidden.forEach(() => {
        createCardView(this, x, y, CARD_WIDTH, CARD_HEIGHT, { id: 'hidden', suit: 'spades', rank: 0, color: 'black' }, { faceUp: false })
        y += hiddenOverlap
      })
      column.up.forEach((card, cardIndex) => {
        const selected = this.selection?.kind === 'column' && this.selection.column === columnIndex && cardIndex >= this.selection.start
        createCardView(this, x + (selected ? 6 : 0), y, CARD_WIDTH, CARD_HEIGHT, card, {
          selected,
          onSelect: () => this.selectColumn(columnIndex, cardIndex)
        }).setDepth(cardIndex + 1)
        y += overlap
      })
    })
  }

  private deal(): void {
    if (this.autoFinishing || this.state.won) return
    this.history.push(this.state)
    this.state = draw(this.state)
    this.hintMessage = stuck(this.state) ? '这局似乎翻不出路了，撤销几步或新开一局吧' : '先点亮着的牌，再点目标位置'
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.audio.playPlace(1)
    this.draw()
  }

  private selectWaste(): void {
    if (this.autoFinishing) return
    // 再点一次选中的废牌 = 取消选中，别让孩子卡在选不出去的牌上。
    if (this.selection) {
      this.selection = null
      this.hintMessage = '已取消选中'
    } else if (this.state.waste.length) {
      this.selection = { kind: 'waste' }
      this.hintMessage = '已选中翻出的牌，点目标位置'
    }
    this.draw()
  }

  private selectColumn(column: number, start: number): void {
    if (this.autoFinishing) return
    if (this.selection) {
      const sameSpot = this.selection.kind === 'column' && this.selection.column === column && this.selection.start === start
      if (sameSpot) {
        this.selection = null
        this.hintMessage = '已取消选中'
        this.draw()
        return
      }
      const otherColumn = !(this.selection.kind === 'column' && this.selection.column === column)
      // 有选中时先尝试移到这一列；成功了 finish 已收尾。
      if (otherColumn && this.tryMoveSelectionToColumn(column)) return
      // 移不动（或同列换选）：落到下面直接改选这张牌，不让孩子卡在旧选择上。
    }
    const up = this.state.columns[column]!.up
    // 从 start 到列顶必须是红黑交替递减的连续段才能整段拿起。
    let valid = true
    for (let index = start; index < up.length - 1; index++) {
      const upper = up[index + 1]!
      if (upper.color === up[index]!.color || upper.rank !== up[index]!.rank - 1) { valid = false; break }
    }
    if (!valid) {
      this.hintMessage = '只能拿红黑交替、逐张小一号的一叠牌'
      this.selection = null
    } else {
      this.selection = { kind: 'column', column, start }
      this.hintMessage = up.length - start > 1 ? `已选中 ${up.length - start} 张，点目标列` : '已选中 1 张，点目标位置'
    }
    this.draw()
  }

  /** 尝试把当前选中的牌移到指定列；返回是否成功（成功时已重绘）。 */
  private tryMoveSelectionToColumn(column: number): boolean {
    const selection = this.selection
    if (!selection) return false
    const result = selection.kind === 'waste'
      ? playWaste(this.state, column)
      : selection.kind === 'foundation'
        ? recall(this.state, selection.suit, column)
        : playColumn(this.state, selection.column, this.state.columns[selection.column]!.up.length - selection.start, column)
    const failure = selection.kind === 'foundation' ? '这里要接颜色相反、点数大一号的牌' : '这里要接颜色相反、点数大一号的牌；空列只能放 K'
    this.finish(result, failure)
    return result.moved
  }

  private selectFoundation(suit: Suit): void {
    if (this.autoFinishing) return
    if (this.selection) { this.targetFoundation(suit); return }
    if (this.state.foundations[suit] > 0) {
      this.selection = { kind: 'foundation', suit }
      this.hintMessage = '已选中基础堆顶，点要垫过去的列'
    }
    this.draw()
  }

  private targetTableau(column: number): void {
    if (this.autoFinishing || !this.selection) return
    // 空位不是牌：移动失败时清掉选中，下次点哪里都是新开始。
    if (!this.tryMoveSelectionToColumn(column) && this.selection) {
      this.selection = null
      this.draw()
    }
  }

  private targetFoundation(suit: Suit): void {
    if (this.autoFinishing || !this.selection) return
    void suit
    const selection = this.selection
    if (selection.kind === 'waste') {
      this.finish(playWaste(this.state, 'foundation'), '基础堆要从 A 开始，按同一花色依次收')
      return
    }
    if (selection.kind !== 'column') return
    const count = this.state.columns[selection.column]!.up.length - selection.start
    if (count > 1) {
      this.hintMessage = '基础堆一次只能收最上面的一张'
      this.draw()
      return
    }
    this.finish(playColumn(this.state, selection.column, 1, 'foundation'), '基础堆要从 A 开始，按同一花色依次收')
  }

  private finish(result: { state: KlondikeState; moved: boolean }, failureMessage: string): void {
    if (result.moved) {
      this.history.push(this.state)
      if (this.history.length > 200) this.history.shift()
      this.state = result.state
      this.hintMessage = '先点亮着的牌，再点目标位置'
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

  /** 残局只剩安全回收时自动替孩子收完（同空当接龙的体验）。 */
  private maybeAutoFinish(): void {
    if (this.autoFinishing || !nextAutoMove(this.state)) return
    this.autoFinishing = true
    this.selection = null
    this.hintMessage = '稳啦，自动收回家～'
    this.draw()
    this.runAutoFinish()
  }

  private runAutoFinish(): void {
    const move = nextAutoMove(this.state)
    if (!move) { this.autoFinishing = false; this.draw(); return }
    const result = move.kind === 'waste'
      ? playWaste(this.state, 'foundation')
      : playColumn(this.state, move.from!, 1, 'foundation')
    if (!result.moved) { this.autoFinishing = false; return }
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
    if (this.autoFinishing || !this.history.length) return
    this.state = this.history.pop()!
    this.selection = null
    this.hintMessage = '已撤销一步'
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.draw()
  }

  private newDeal(): void {
    this.state = newDeal()
    this.initialDeal = this.state
    this.history = []
    this.selection = null
    this.autoFinishing = false
    this.hintMessage = '先点亮着的牌，再点目标位置'
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.draw()
  }

  private restartDeal(): void {
    this.state = this.initialDeal
    this.history = []
    this.selection = null
    this.autoFinishing = false
    this.hintMessage = '已重开本局'
    this.callbacks.onStateChange(this.state, this.initialDeal)
    this.draw()
  }

  private drawWin(): void {
    const badge = this.add.text(512, 400, '✦ 太棒啦 ✦', {
      color: '#fffdf6', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '44px', fontStyle: 'bold'
    }).setOrigin(0.5)
    badge.setScale(0.7)
    this.tweens.add({ targets: badge, scale: 1, duration: 260, ease: 'Back.Out' })
  }
}
