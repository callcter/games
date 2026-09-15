import { SUITS, type Card, type RandomSource, type Suit } from '../../cards/core/cards'

export interface FreeCellState {
  tableau: readonly (readonly Card[])[]
  freeCells: readonly (Card | null)[]
  foundations: Readonly<Record<Suit, number>>
  moves: number
  won: boolean
  /** 微软经典牌局编号；0 表示旧版随机发牌的存档，无编号 */
  gameNumber: number
}

export interface MoveResult {
  state: FreeCellState
  moved: boolean
}

/** 微软经典牌局共 32000 局，其中仅 11982 已被证明无解 */
export const MICROSOFT_GAME_COUNT = 32000
export const UNSOLVABLE_GAME_NUMBERS = new Set([11982])

export function newGame(random: RandomSource = Math.random): FreeCellState {
  return newNumberedGame(randomGameNumber(random))
}

export function newNumberedGame(gameNumber: number): FreeCellState {
  const tableau: Card[][] = Array.from({ length: 8 }, () => [])
  microsoftDeal(gameNumber).forEach((card, index) => tableau[index % 8]?.push(card))
  return {
    tableau,
    freeCells: [null, null, null, null],
    foundations: { spades: 0, hearts: 0, clubs: 0, diamonds: 0 },
    moves: 0,
    won: false,
    gameNumber
  }
}

/** 随机挑选一个微软经典局号，跳过已知无解的牌局 */
export function randomGameNumber(random: RandomSource = Math.random): number {
  const choices = MICROSOFT_GAME_COUNT - UNSOLVABLE_GAME_NUMBERS.size
  const raw = Math.floor(normalize(random()) * choices) + 1
  if (raw >= 11982) return raw + 1
  return raw
}

/**
 * 微软 FreeCell 的经典发牌算法：线性同余序列决定每张牌的位置。
 * 同一局号在所有平台上得到完全相同的牌局。
 */
export function microsoftDeal(gameNumber: number): Card[] {
  if (!Number.isInteger(gameNumber) || gameNumber < 1 || gameNumber > MICROSOFT_GAME_COUNT) {
    throw new Error(`牌局编号必须是 1 到 ${MICROSOFT_GAME_COUNT} 之间的整数`)
  }
  let seed = gameNumber
  const rand = (): number => {
    seed = (seed * 214013 + 2531011) % 2147483648
    return Math.floor(seed / 65536)
  }
  const remaining = Array.from({ length: 52 }, (_, index) => index)
  const dealt: Card[] = []
  for (let index = 0; index < 52; index += 1) {
    const left = remaining.length
    const choice = rand() % left
    const value = remaining[choice]
    if (value === undefined) throw new Error('发牌过程出现空位，实现有误')
    dealt.push(toCard(value))
    remaining[choice] = remaining[left - 1]!
    remaining.pop()
  }
  return dealt
}

function toCard(value: number): Card {
  const suit = (['clubs', 'diamonds', 'hearts', 'spades'] as const)[value % 4]!
  const rank = Math.floor(value / 4) + 1
  return { id: `0-${suit}-${rank}`, suit, rank, color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black' }
}

function normalize(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 0.999999999999))
}

export function movableSequenceLength(column: readonly Card[], start: number): number {
  if (start < 0 || start >= column.length) return 0
  for (let index = start; index < column.length - 1; index += 1) {
    const upper = column[index]
    const lower = column[index + 1]
    if (!upper || !lower || upper.rank !== lower.rank + 1 || upper.color === lower.color) return 0
  }
  return column.length - start
}

export function moveTableauToTableau(state: FreeCellState, from: number, to: number, count = 1): MoveResult {
  if (from === to || !isColumn(from) || !isColumn(to)) return unchanged(state)
  const source = state.tableau[from] ?? []
  const target = state.tableau[to] ?? []
  const start = source.length - count
  if (count < 1 || movableSequenceLength(source, start) !== count) return unchanged(state)
  if (count > maxMovableCards(state, to)) return unchanged(state)
  const first = source[start]
  const targetTop = target.at(-1)
  if (!first || (targetTop && (targetTop.rank !== first.rank + 1 || targetTop.color === first.color))) return unchanged(state)

  const tableau = state.tableau.map((column) => [...column])
  const moving = tableau[from]?.splice(start, count) ?? []
  tableau[to]?.push(...moving)
  return finishMove(state, { tableau })
}

export function moveTableauToFreeCell(state: FreeCellState, from: number, freeCell: number): MoveResult {
  if (!isColumn(from) || !isFreeCell(freeCell) || state.freeCells[freeCell] !== null) return unchanged(state)
  const tableau = state.tableau.map((column) => [...column])
  const card = tableau[from]?.pop()
  if (!card) return unchanged(state)
  const freeCells = [...state.freeCells]
  freeCells[freeCell] = card
  return finishMove(state, { tableau, freeCells })
}

export function moveFreeCellToTableau(state: FreeCellState, freeCell: number, to: number): MoveResult {
  if (!isFreeCell(freeCell) || !isColumn(to)) return unchanged(state)
  const card = state.freeCells[freeCell]
  if (!card) return unchanged(state)
  const targetTop = state.tableau[to]?.at(-1)
  if (targetTop && (targetTop.rank !== card.rank + 1 || targetTop.color === card.color)) return unchanged(state)
  const tableau = state.tableau.map((column) => [...column])
  tableau[to]?.push(card)
  const freeCells = [...state.freeCells]
  freeCells[freeCell] = null
  return finishMove(state, { tableau, freeCells })
}

export function moveTableauToFoundation(state: FreeCellState, from: number): MoveResult {
  if (!isColumn(from)) return unchanged(state)
  const tableau = state.tableau.map((column) => [...column])
  const card = tableau[from]?.at(-1)
  if (!card || state.foundations[card.suit] + 1 !== card.rank) return unchanged(state)
  tableau[from]?.pop()
  return addToFoundation(state, card, { tableau })
}

export function moveFreeCellToFoundation(state: FreeCellState, freeCell: number): MoveResult {
  if (!isFreeCell(freeCell)) return unchanged(state)
  const card = state.freeCells[freeCell]
  if (!card || state.foundations[card.suit] + 1 !== card.rank) return unchanged(state)
  const freeCells = [...state.freeCells]
  freeCells[freeCell] = null
  return addToFoundation(state, card, { freeCells })
}

export function maxMovableCards(state: FreeCellState, targetColumn: number): number {
  const free = state.freeCells.filter((card) => card === null).length
  const emptyColumns = state.tableau.filter((column, index) => column.length === 0 && index !== targetColumn).length
  return (free + 1) * 2 ** emptyColumns
}

export function restoreGame(value: unknown): FreeCellState | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<FreeCellState>
  if (!Array.isArray(candidate.tableau) || candidate.tableau.length !== 8) return null
  if (!Array.isArray(candidate.freeCells) || candidate.freeCells.length !== 4) return null
  if (!candidate.foundations || typeof candidate.foundations !== 'object') return null
  if (!Number.isInteger(candidate.moves) || (candidate.moves ?? -1) < 0 || typeof candidate.won !== 'boolean') return null
  const gameNumber = candidate.gameNumber ?? 0
  if (!Number.isInteger(gameNumber) || gameNumber < 0 || gameNumber > MICROSOFT_GAME_COUNT) return null

  const foundations = candidate.foundations as Record<string, unknown>
  if (!SUITS.every((suit) => Number.isInteger(foundations[suit]) && Number(foundations[suit]) >= 0 && Number(foundations[suit]) <= 13)) return null
  if (!candidate.tableau.every((column) => Array.isArray(column) && column.every(isCard))) return null
  if (!candidate.freeCells.every((card) => card === null || isCard(card))) return null

  const visibleCards = [...candidate.tableau.flat(), ...candidate.freeCells.filter((card): card is Card => card !== null)]
  const actual = visibleCards.map((card) => `${card.suit}-${card.rank}`).sort()
  const expected = SUITS.flatMap((suit) => {
    const foundationRank = Number(foundations[suit])
    return Array.from({ length: 13 - foundationRank }, (_, index) => `${suit}-${foundationRank + index + 1}`)
  }).sort()
  if (actual.length !== expected.length || actual.some((card, index) => card !== expected[index])) return null

  const won = SUITS.every((suit) => Number(foundations[suit]) === 13)
  if (candidate.won !== won) return null
  return {
    tableau: candidate.tableau.map((column) => column.map((card) => ({ ...card }))),
    freeCells: candidate.freeCells.map((card) => card ? { ...card } : null),
    foundations: Object.fromEntries(SUITS.map((suit) => [suit, Number(foundations[suit])])) as Record<Suit, number>,
    moves: candidate.moves ?? 0,
    won,
    gameNumber
  }
}

function addToFoundation(
  state: FreeCellState,
  card: Card,
  changes: Partial<Pick<FreeCellState, 'tableau' | 'freeCells'>>
): MoveResult {
  const foundations = { ...state.foundations, [card.suit]: card.rank }
  return finishMove(state, { ...changes, foundations })
}

function finishMove(state: FreeCellState, changes: Partial<FreeCellState>): MoveResult {
  const next = { ...state, ...changes, moves: state.moves + 1 }
  const won = SUITS.every((suit) => next.foundations[suit] === 13)
  return { state: { ...next, won }, moved: true }
}

function unchanged(state: FreeCellState): MoveResult {
  return { state, moved: false }
}

function isColumn(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < 8
}

function isFreeCell(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < 4
}

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== 'object') return false
  const card = value as Partial<Card>
  return typeof card.id === 'string'
    && SUITS.includes(card.suit as Suit)
    && Number.isInteger(card.rank)
    && (card.rank ?? 0) >= 1
    && (card.rank ?? 0) <= 13
    && card.color === (card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black')
}
