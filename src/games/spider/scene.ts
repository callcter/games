import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createPuzzleChrome } from '../../ui'
import { PRODUCT_V3, preloadCardsV3 } from '../../platform/display/product-v3-art'
import { attachFirstRunHelp, showHelpPanel } from '../../ui/phaser/help'
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

import { clearSceneChildren } from '../../platform/display/clear-children'
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
  private dealingColumns: readonly number[] = []
  private dealing = false
  private readonly audio: GameAudio
  private readonly callbacks: SceneCallbacks

  constructor(audio: GameAudio, callbacks: SceneCallbacks, initialState = newGame(), initialDeal = initialState) {
    super({ key: 'spider' })
    this.audio = audio
    this.callbacks = callbacks
    this.state = initialState
    this.initialDeal = initialDeal
  }

  preload(): void {
    preloadCardsV3(this)
  }

  create(): void {
    attachFirstRunHelp(this, '蜘蛛纸牌')
    this.input.on('pointerdown', () => void this.audio.unlock())
    // 拖牌（Experience 2.0 Wave 1）：拿起跟手、松手按落点提交；轻点退回点选。
    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, object: unknown) => this.beginCardDrag(object))
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, object: unknown, dragX: number, dragY: number) => this.moveCardDrag(object, dragX, dragY))
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, object: unknown) => this.endCardDrag(object))
    this.draw()
  }

  // ---------- 拖牌会话 ----------

  private dragGroup: Phaser.GameObjects.Container[] = []
  private dragOffsets: Array<{ x: number; y: number }> = []
  private dragOrigin = { x: 0, y: 0 }
  private dragMoved = false
  /** 列号:起点 → 从该牌到列顶的 view 序列（draw 时重建）。 */
  private readonly columnViews = new Map<string, Phaser.GameObjects.Container[]>()

  private beginCardDrag(object: unknown): void {
    if (this.state.won || this.dealing || this.dragGroup.length) return
    if (!(object instanceof Phaser.GameObjects.Container)) return
    const source = object.getData('cardSource') as { column: number; start: number } | undefined
    if (!source) return
    const faceUps = this.columnViews.get(`${source.column}`) ?? [object]
    const group = faceUps.slice(faceUps.length - (this.state.tableau[source.column]!.length - source.start))
    this.dragGroup = group
    this.dragOffsets = group.map(view => ({ x: view.x - group[0]!.x, y: view.y - group[0]!.y }))
    this.dragOrigin = { x: group[0]!.x, y: group[0]!.y }
    this.dragMoved = false
    // 不在这里清空 selection：轻点（无位移）的 dragend 要靠它完成「选源牌→点目标」；
    // 只有真正拖动起来才切换会话、放弃旧选中。
    group.forEach(view => this.children.bringToTop(view))
    this.audio.playMove()
  }

  private moveCardDrag(object: unknown, dragX: number, dragY: number): void {
    if (!this.dragGroup.length || object !== this.dragGroup[0]) return
    if (!this.dragMoved) { this.dragMoved = true; this.selection = null }
    this.dragGroup.forEach((view, index) => {
      const offset = this.dragOffsets[index]!
      view.setPosition(dragX + offset.x, dragY + offset.y)
    })
  }

  private endCardDrag(object: unknown): void {
    if (!this.dragGroup.length || object !== this.dragGroup[0]) return
    const source = (object as Phaser.GameObjects.Container).getData('cardSource') as { column: number; start: number }
    const head = this.dragGroup[0]!
    this.dragGroup = []
    if (!this.dragMoved || (Math.abs(head.x - this.dragOrigin.x) < 6 && Math.abs(head.y - this.dragOrigin.y) < 6)) {
      this.draw()
      this.selectCard(source.column, source.start)
      return
    }
    const column = Math.round((head.x - CARD_WIDTH / 2 - COLUMN_X) / (CARD_WIDTH + COLUMN_GAP))
    if (column >= 0 && column < 10 && column !== source.column) {
      const result = moveSequence(this.state, source.column, source.start, column)
      if (result.moved) { this.finish(result); return }
    }
    this.hintMessage = '放不进去，换个位置试试'
    this.draw()
  }

  private draw(): void {
    this.tweens.killAll()
    clearSceneChildren(this)
    const table = this.add.image(512, 384, PRODUCT_V3.cards.table)
    table.setDisplaySize(1024, 768).setDepth(-100)
    this.add.rectangle(512, 384, 1024, 768, 0x173f35, 0.10).setDepth(-90)
    this.columnViews.clear()
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
    // 全站统一顶栏（紧凑档）：工具药丸/帮助/声音同一行；难度收进完成槽行右侧空白。
    const chrome = createPuzzleChrome(this, {
      title: '蜘蛛纸牌',
      audio: this.audio,
      onBack: this.callbacks.onExit,
      onHelp: () => { showHelpPanel(this, '蜘蛛纸牌') },
      compactContent: true,
      tools: [
        { icon: 'hint', label: '提示', action: () => this.showHint() },
        { icon: 'undo', label: '撤销', action: () => this.undo() },
        { icon: 'restart', label: '重开本局', action: () => this.restartDeal() },
        { icon: 'new', label: '新牌局', action: () => this.newDeal() }
      ]
    })
    chrome.setStatus('')
    chrome.layout(1024, 768)
    this.add.text(512, 80, `得分 ${this.state.score} · 移动 ${this.state.moves} 次${this.hintMessage ? ` · ${this.hintMessage}` : ''}`, {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '16px'
    }).setOrigin(0.5, 0)
    // 完成槽（x38-616、y96-160）右侧留白正好放难度；y128 与槽垂直居中。
    this.createDifficultyButton(660, 128, 1, '一花色')
    this.createDifficultyButton(770, 128, 2, '两花色')
    this.createDifficultyButton(880, 128, 4, '四花色')
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
      if (card) createCardView(this, 900, 92, 76, 82, card, { faceUp: false, onSelect: () => this.deal() })
      this.add.text(938, 133, String(remainingDeals), {
        color: '#fffdf6', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '22px', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(5)
    } else {
      createCardSlot(this, 900, 92, 76, 82, '空', () => undefined)
    }
    // 说明文字放牌左侧竖排，避免压在牌背和最后一列牌上
    this.add.text(888, 104, '发牌', {
      color: '#d7e7df', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '15px', fontStyle: 'bold'
    }).setOrigin(1, 0.5)
    this.add.text(888, 128, '每列一张', {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '13px'
    }).setOrigin(1, 0.5)
  }

  private drawTableau(): void {
    const longest = Math.max(...this.state.tableau.map((column) => column.length), 1)
    const overlap = Math.min(29, Math.max(15, (750 - TABLEAU_Y - CARD_HEIGHT) / Math.max(1, longest - 1)))
    const dealtLast = this.dealingColumns.length > 0
    this.state.tableau.forEach((column, columnIndex) => {
      const x = COLUMN_X + columnIndex * (CARD_WIDTH + COLUMN_GAP)
      createCardSlot(this, x, TABLEAU_Y, CARD_WIDTH, CARD_HEIGHT, '', () => this.targetColumn(columnIndex))
      const upViews: Phaser.GameObjects.Container[] = []
      column.forEach((item, cardIndex) => {
        const y = TABLEAU_Y + cardIndex * overlap
        const selected = this.selection?.column === columnIndex && cardIndex >= this.selection.start
        // 可拖的明牌不绑 pointerdown 选择（拖动不重绘）；不可拖的保留点选提示路径。
        const draggable = item.faceUp && movableSequenceLength(column, cardIndex) > 0
        const view = createCardView(this, x + (selected ? 5 : 0), y, CARD_WIDTH, CARD_HEIGHT, item.card, {
          faceUp: item.faceUp,
          selected,
          onSelect: draggable ? undefined : () => this.selectCard(columnIndex, cardIndex)
        }).setDepth(cardIndex + 1)
        if (draggable) {
          view.setData('cardSource', { column: columnIndex, start: cardIndex })
          this.input.setDraggable(view)
        }
        // 本轮新发的牌从右上牌堆依次飞入，让孩子看清每列到了哪张
        if (dealtLast && cardIndex === column.length - 1 && this.dealingColumns.includes(columnIndex)) {
          const order = this.dealingColumns.indexOf(columnIndex)
          view.setPosition(900, 92)
          this.tweens.add({
            targets: view,
            x: x + (selected ? 5 : 0),
            y,
            duration: 300,
            delay: order * 60,
            ease: 'Cubic.Out'
          })
        }
        upViews.push(view)
      })
      this.columnViews.set(`${columnIndex}`, upViews)
    })
    if (dealtLast) {
      const flightMs = 300 + this.dealingColumns.length * 60
      this.time.delayedCall(flightMs, () => {
        this.dealing = false
        this.dealingColumns = []
      })
    }
  }

  private selectCard(column: number, start: number): void {
    this.hintMessage = ''
    if (this.selection) {
      if (this.selection.column !== column) {
        this.targetColumn(column)
        return
      }
      if (this.selection.start === start) {
        this.selection = null
        this.hintMessage = '已取消选中'
        this.draw()
        return
      }
    }
    const count = movableSequenceLength(this.state.tableau[column] ?? [], start)
    if (count > 0) {
      this.selection = { column, start }
      this.hintMessage = count > 1 ? `已选中 ${count} 张，点另一列移动` : '已选中 1 张，点目标列'
    } else {
      this.selection = null
      this.hintMessage = '只能移动同花色、逐张递减的明牌'
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
    if (this.dealing) return
    this.dealing = true
    const lengthsBefore = this.state.tableau.map((column) => column.length)
    const result = dealStock(this.state)
    if (!result.moved) {
      this.hintMessage = this.state.tableau.some((column) => column.length === 0)
        ? '有空列时不能发牌，先把牌移过去'
        : '牌堆已经发完了'
      this.draw()
      return
    }
    this.dealingColumns = result.state.tableau
      .map((column, index) => column.length > (lengthsBefore[index] ?? 0) ? index : -1)
      .filter((index) => index >= 0)
    this.finish(result, `每列发一张，还剩 ${Math.floor(result.state.stock.length / 10)} 轮`)
  }

  private finish(result: SpiderMoveResult, hint = ''): void {
    if (result.moved) {
      this.history.push(this.state)
      this.state = result.state
      this.hintMessage = hint
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
