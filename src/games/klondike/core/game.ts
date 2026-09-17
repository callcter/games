import { createDeck, shuffle, SUITS, type Card, type RandomSource, type Suit } from '../../cards/core/cards'

// 经典纸牌（Klondike）：7 列牌桌（红黑交替递减）、翻牌堆逐张翻、基础堆按花色
// A→K 回收，空列只收 K。规则层无 Phaser/DOM 依赖，随机由注入源提供。

export interface Column { hidden: Card[]; up: Card[] }

export interface KlondikeState {
  stock: Card[] // 待翻牌堆（顶为数组末尾）
  waste: Card[] // 已翻出的牌（顶为数组末尾，仅顶牌可动）
  foundations: Record<Suit, number> // 每花色已回收到的基础堆顶 rank（0=A 未出）
  columns: Column[]
  moves: number
  won: boolean
}

const isRed = (card: Card): boolean => card.suit === 'hearts' || card.suit === 'diamonds'

/** 目标列可否接收这张牌：空列只收 K；非空列要求颜色交替且 rank 严格小 1。 */
export function canDropOnColumn(card: Card, column: Column): boolean {
  const top = column.up[column.up.length - 1]
  if (!top) return card.rank === 13
  return isRed(card) !== isRed(top) && top.rank === card.rank + 1
}

function canDropOnFoundation(card: Card, foundations: Record<Suit, number>): boolean {
  return card.rank === foundations[card.suit] + 1
}

function refreshed(state: KlondikeState, foundations: Record<Suit, number>, moves: number): KlondikeState {
  return { ...state, foundations, moves, won: SUITS.every(suit => foundations[suit] === 13) }
}

/** 发一副新牌：7 列（第 i 列 i+1 张、仅顶牌明），其余 24 张进翻牌堆。 */
export function newDeal(random: RandomSource = Math.random): KlondikeState {
  const deck = shuffle(createDeck(), random)
  const columns: Column[] = Array.from({ length: 7 }, (_, index) => {
    const dealt = deck.splice(0, index + 1)
    return { hidden: dealt.slice(0, -1), up: dealt.slice(-1) }
  })
  return {
    stock: deck, waste: [],
    foundations: { spades: 0, hearts: 0, clubs: 0, diamonds: 0 },
    columns, moves: 0, won: false
  }
}

/** 翻牌：翻牌堆顶一张到废牌堆；翻完把废牌堆整叠翻回（经典翻一不限次数）。 */
export function draw(state: KlondikeState): KlondikeState {
  if (state.won) return state
  if (state.stock.length) {
    const stock = [...state.stock]
    const card = stock.pop()!
    return { ...state, stock, waste: [...state.waste, card], moves: state.moves + 1 }
  }
  if (!state.waste.length) return state
  return { ...state, stock: [...state.waste].reverse(), waste: [], moves: state.moves + 1 }
}

export interface PlayResult { state: KlondikeState; moved: boolean }

/** 废牌堆顶牌送去基础堆或某列。 */
export function playWaste(state: KlondikeState, to: number | 'foundation'): PlayResult {
  const card = state.waste[state.waste.length - 1]
  if (!card || state.won) return { state, moved: false }
  const waste = state.waste.slice(0, -1)
  if (to === 'foundation') {
    if (!canDropOnFoundation(card, state.foundations)) return { state, moved: false }
    const foundations = { ...state.foundations, [card.suit]: state.foundations[card.suit] + 1 }
    return { state: refreshed({ ...state, waste }, foundations, state.moves + 1), moved: true }
  }
  const column = state.columns[to]
  if (!column || !canDropOnColumn(card, column)) return { state, moved: false }
  const columns = state.columns.map((entry, index) => index === to ? { hidden: entry.hidden, up: [...entry.up, card] } : entry)
  return { state: { ...state, waste, columns, moves: state.moves + 1 }, moved: true }
}

/** 列顶 count 张连续合法段移到另一列（count=1 也可送基础堆）。 */
export function playColumn(state: KlondikeState, from: number, count: number, to: number | 'foundation'): PlayResult {
  if (state.won || from === to) return { state, moved: false }
  const source = state.columns[from]
  if (!source || count < 1 || count > source.up.length) return { state, moved: false }
  // 从段头开始必须自身就是红黑交替递减的连续段。
  for (let index = source.up.length - count; index < source.up.length - 1; index++) {
    const lower = source.up[index + 1]!
    if (isRed(lower) === isRed(source.up[index]!) || lower.rank !== source.up[index]!.rank - 1) return { state, moved: false }
  }
  const moving = source.up.slice(-count)
  const head = moving[0]!
  const detach = (columns: Column[]): Column[] => columns.map((entry, index) => {
    if (index !== from) return entry
    const up = entry.up.slice(0, -count)
    return { hidden: entry.hidden, up: up.length ? up : [] }
  })
  if (to === 'foundation') {
    if (count !== 1 || !canDropOnFoundation(head, state.foundations)) return { state, moved: false }
    const foundations = { ...state.foundations, [head.suit]: state.foundations[head.suit] + 1 }
    return { state: refreshed({ ...state, columns: reveal(detach(state.columns), from) }, foundations, state.moves + 1), moved: true }
  }
  const target = state.columns[to]
  if (!target || !canDropOnColumn(head, target)) return { state, moved: false }
  const columns = detach(state.columns).map((entry, index) => index === to ? { hidden: entry.hidden, up: [...entry.up, ...moving] } : entry)
  return { state: { ...state, columns: reveal(columns, from), moves: state.moves + 1 }, moved: true }
}

/** 基础堆顶取回到某列（需要垫牌时允许）。 */
export function recall(state: KlondikeState, suit: Suit, to: number): PlayResult {
  if (state.won) return { state, moved: false }
  const rank = state.foundations[suit]
  if (!rank) return { state, moved: false }
  const card: Card = { id: `${suit}-${rank}`, suit, rank, color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black' }
  const column = state.columns[to]
  if (!column || !canDropOnColumn(card, column)) return { state, moved: false }
  const columns = state.columns.map((entry, index) => index === to ? { hidden: entry.hidden, up: [...entry.up, card] } : entry)
  return {
    state: { ...state, columns, foundations: { ...state.foundations, [suit]: rank - 1 }, moves: state.moves + 1, won: false },
    moved: true
  }
}

/** 列顶明牌被移走后，若其下还有暗牌则翻开。 */
function reveal(columns: Column[], from: number): Column[] {
  return columns.map((entry, index) => {
    if (index !== from || entry.up.length || !entry.hidden.length) return entry
    const hidden = [...entry.hidden]
    const card = hidden.pop()!
    return { hidden, up: [card] }
  })
}

/**
 * 残局自动收尾（安全自动上基础堆）：A/2 恒安全；更大的牌需要两个异色基础堆
 * 都收到 rank-1 才安全（保证需要垫牌时随时可取回）。返回下一步自动动作。
 */
export function nextAutoMove(state: KlondikeState): { kind: 'waste' | 'column'; from?: number } | null {
  if (state.won) return null
  const safe = (card: Card): boolean => card.rank <= 2
    || (isRed(card) ? state.foundations.clubs >= card.rank - 1 && state.foundations.spades >= card.rank - 1
      : state.foundations.hearts >= card.rank - 1 && state.foundations.diamonds >= card.rank - 1)
  const wasteTop = state.waste[state.waste.length - 1]
  if (wasteTop && canDropOnFoundation(wasteTop, state.foundations) && safe(wasteTop)) return { kind: 'waste' }
  for (let index = 0; index < state.columns.length; index++) {
    const column = state.columns[index]!
    // 只有整列只剩明牌（无暗牌垫底）时才自动收，避免抽走垫子破坏列结构。
    if (column.hidden.length) continue
    const top = column.up[column.up.length - 1]
    if (top && canDropOnFoundation(top, state.foundations) && safe(top)) return { kind: 'column', from: index }
  }
  return null
}

/** 是否已无任何可行进路（供界面提示重开；Klondike 不保证每局可解）。 */
export function stuck(state: KlondikeState): boolean {
  if (state.won) return false
  const wasteTop = state.waste[state.waste.length - 1]
  const canGoAnywhere = (card: Card): boolean =>
    canDropOnFoundation(card, state.foundations)
    || state.columns.some(column => canDropOnColumn(card, column))
  if (wasteTop && canGoAnywhere(wasteTop)) return false
  for (let index = 0; index < state.columns.length; index++) {
    const column = state.columns[index]!
    for (let start = 0; start < column.up.length; start++) {
      const head = column.up[start]!
      if (start > 0) {
        const below = column.up[start - 1]!
        if (isRed(below) === isRed(head) || below.rank !== head.rank + 1) break // 段不连续
      }
      if (state.columns.some((target, targetIndex) => targetIndex !== index && canDropOnColumn(head, target))) return false
    }
  }
  if (state.stock.length || state.waste.length) return false // 还能继续翻牌
  return true
}

/** 恢复存档：校验 52 张完整（含基础堆已收的）、7 列结构与花色不与基础堆重复。
 * 坏档返回 null，由调用方重新发牌。 */
export function reviveState(value: unknown): KlondikeState | null {
  if (!value || typeof value !== 'object') return null
  const state = value as KlondikeState
  if (!Array.isArray(state.columns) || state.columns.length !== 7
    || !Array.isArray(state.stock) || !Array.isArray(state.waste)) return null
  const foundations = state.foundations
  if (!foundations || SUITS.some(suit => !Number.isInteger(foundations[suit]) || foundations[suit] < 0 || foundations[suit] > 13)) return null
  const cards = [...state.stock, ...state.waste, ...state.columns.flatMap(column => [...(column?.hidden ?? []), ...(column?.up ?? [])])]
  const collected = SUITS.reduce((sum, suit) => sum + foundations[suit], 0)
  if (cards.length + collected !== 52) return null
  if (new Set(cards.map(card => card?.id)).size !== cards.length) return null
  // 基础堆已收的花色 1..rank 不能再出现在场上。
  if (cards.some(card => card && card.rank <= foundations[card.suit])) return null
  if (!Number.isInteger(state.moves) || state.moves < 0) return null
  return { ...state, won: SUITS.every(suit => foundations[suit] === 13) }
}
