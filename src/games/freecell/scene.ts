import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { createPuzzleChrome } from '../../ui'
import { PRODUCT_V3, preloadCardsV3 } from '../../platform/display/product-v3-art'
import { attachFirstRunHelp, showHelpPanel } from '../../ui/phaser/help'
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

  preload(): void {
    preloadCardsV3(this)
  }

  create(): void {
    attachFirstRunHelp(this, '空当接龙')
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
    if (this.autoFinishing || this.state.won || this.dragGroup.length) return
    if (!(object instanceof Phaser.GameObjects.Container)) return
    const source = object.getData('cardSource') as { kind: 'freecell' | 'tableau'; index: number; column: number; start: number } | undefined
    if (!source) return
    const group = source.kind === 'tableau'
      ? (this.columnViews.get(`${source.column}`) ?? [object]).slice(source.start)
      : [object]
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
    const group = this.dragGroup
    const source = (object as Phaser.GameObjects.Container).getData('cardSource') as { kind: 'freecell' | 'tableau'; index: number; column: number; start: number }
    const head = group[0]!
    this.dragGroup = []
    // 轻点退回点选路径。
    if (!this.dragMoved || (Math.abs(head.x - this.dragOrigin.x) < 6 && Math.abs(head.y - this.dragOrigin.y) < 6)) {
      this.draw()
      if (source.kind === 'freecell') this.selectFreeCell(source.index)
      else if (source.kind === 'tableau') this.selectTableau(source.column, source.start)
      return
    }
    const x = head.x - CARD_WIDTH / 2
    const y = head.y - CARD_HEIGHT / 2
    // 基础堆区（单张）。
    if (group.length === 1 && y < TABLEAU_Y - 40) {
      const foundationIndex = Math.round((x - 576) / 104)
      if (foundationIndex >= 0 && foundationIndex < 4) {
        const result = source.kind === 'tableau'
          ? moveTableauToFoundation(this.state, source.column)
          : moveFreeCellToFoundation(this.state, source.index)
        if (result.moved) { this.finish(result, '回收区要按同一花色从 A 依次收'); return }
      }
      // 空当区（单张）。
      const freeIndex = Math.round((x - 40) / 112)
      if (freeIndex >= 0 && freeIndex < 4 && source.kind === 'tableau') {
        const result = moveTableauToFreeCell(this.state, source.column, freeIndex)
        if (result.moved) { this.finish(result, '空当格里已经有一张了'); return }
      }
    }
    // 牌列。
    const column = Math.round((x - TABLEAU_X) / (CARD_WIDTH + COLUMN_GAP))
    if (column >= 0 && column < 8) {
      const movedCount = source.kind === 'tableau' ? this.state.tableau[source.column]!.length - source.start : 1
      const result = source.kind === 'tableau'
        ? moveTableauToTableau(this.state, source.column, column, this.state.tableau[source.column]!.length - source.start)
        : moveFreeCellToTableau(this.state, source.index, column)
      if (result.moved) {
        this.finish(result, movedCount > 1 ? '一次可搬的张数受空当格和空列限制' : '这里要接颜色相反、点数大一号的牌')
        return
      }
    }
    this.hintMessage = '放不进去，换个位置试试'
    this.draw()
  }

  private draw(): void {
    this.children.removeAll(true)
    const table = this.add.image(512, 384, PRODUCT_V3.cards.table)
    table.setDisplaySize(1024, 768).setDepth(-100)
    this.add.rectangle(512, 384, 1024, 768, 0x173f35, 0.10).setDepth(-90)
    this.columnViews.clear()
    this.cameras.main.setBackgroundColor('#23614f')
    this.drawHeader()
    this.drawTopSlots()
    this.drawTableau()
    if (this.state.won) this.drawWin()
  }

  private drawHeader(): void {
    // 全站统一顶栏（紧凑档贴牌桌）：药丸工具/帮助/声音在同一行，信息行留作牌桌 HUD。
    const chrome = createPuzzleChrome(this, {
      title: '空当接龙',
      audio: this.audio,
      onBack: this.callbacks.onExit,
      onHelp: () => { showHelpPanel(this, '空当接龙') },
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
    const gameLabel = this.state.gameNumber > 0 ? `第 ${this.state.gameNumber} 局 · ` : ''
    this.add.text(512, 80, `${gameLabel}移动 ${this.state.moves} 次 · ${this.hintMessage}`, {
      color: '#b9d5c9', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '16px'
    }).setOrigin(0.5, 0)
  }

  private drawTopSlots(): void {
    for (let index = 0; index < 4; index += 1) {
      const x = 40 + index * 112
      const card = this.state.freeCells[index]
      if (card) {
        // 空当牌可拖：不绑 pointerdown 选择，避免拖动开始即重绘；轻点由 dragend 处理。
        const view = createCardView(this, x, 92, CARD_WIDTH, CARD_HEIGHT * 0.82, card, {
          selected: this.selection?.kind === 'freecell' && this.selection.index === index
        })
        view.setData('cardSource', { kind: 'freecell', index, column: -1, start: -1 })
        this.input.setDraggable(view)
      } else {
        createCardSlot(this, x, 92, CARD_WIDTH, CARD_HEIGHT * 0.82, '空', () => this.targetFreeCell(index))
      }
    }

    SUITS.forEach((suit, index) => {
      const x = 576 + index * 104
      const rank = this.state.foundations[suit]
      if (rank > 0) {
        const card = { id: `foundation-${suit}-${rank}`, suit, rank, color: suit === 'hearts' || suit === 'diamonds' ? 'red' as const : 'black' as const }
        // Foundation 只是回收终点（drop target），规则不支持取回，因此不可作为拖动源。
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
      const upViews: Phaser.GameObjects.Container[] = []
      column.forEach((card, cardIndex) => {
        const selected = this.selection?.kind === 'tableau'
          && this.selection.column === columnIndex
          && cardIndex >= this.selection.start
        // 可拖的牌不绑 pointerdown 选择（拖动不重绘）；不可拖的保留点选提示路径。
        const draggable = movableSequenceLength(column, cardIndex) > 0
        const view = createCardView(this, x + (selected ? 6 : 0), TABLEAU_Y + cardIndex * overlap, CARD_WIDTH, CARD_HEIGHT, card, {
          selected,
          onSelect: draggable ? undefined : () => this.selectTableau(columnIndex, cardIndex)
        }).setDepth(cardIndex + 1)
        view.setData('cardSource', { kind: 'tableau' as const, index: -1, column: columnIndex, start: cardIndex })
        if (draggable) this.input.setDraggable(view)
        upViews.push(view)
      })
      this.columnViews.set(`${columnIndex}`, upViews)
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
