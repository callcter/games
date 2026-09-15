import { createDeck, shuffle, type Card, type RandomSource } from '../../cards/core/cards'

export interface SpiderCard {
  card: Card
  faceUp: boolean
}

export interface SpiderState {
  tableau: readonly (readonly SpiderCard[])[]
  stock: readonly Card[]
  completedRuns: number
  moves: number
  score: number
  won: boolean
}

export interface SpiderMoveResult {
  state: SpiderState
  moved: boolean
  completed: number
}

export function newGame(random: RandomSource = Math.random): SpiderState {
  const deck = shuffle(createDeck(8, ['spades']), random)
  const tableau: SpiderCard[][] = Array.from({ length: 10 }, () => [])
  let cursor = 0
  tableau.forEach((column, index) => {
    const count = index < 4 ? 6 : 5
    for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
      const card = deck[cursor]
      if (card) column.push({ card, faceUp: cardIndex === count - 1 })
      cursor += 1
    }
  })
  return { tableau, stock: deck.slice(cursor), completedRuns: 0, moves: 0, score: 500, won: false }
}

export function movableSequenceLength(column: readonly SpiderCard[], start: number): number {
  if (start < 0 || start >= column.length || !column[start]?.faceUp) return 0
  for (let index = start; index < column.length - 1; index += 1) {
    const upper = column[index]
    const lower = column[index + 1]
    if (!upper?.faceUp || !lower?.faceUp || upper.card.rank !== lower.card.rank + 1) return 0
  }
  return column.length - start
}

export function moveSequence(state: SpiderState, from: number, start: number, to: number): SpiderMoveResult {
  if (!isColumn(from) || !isColumn(to) || from === to) return unchanged(state)
  const source = state.tableau[from] ?? []
  const target = state.tableau[to] ?? []
  const count = movableSequenceLength(source, start)
  if (count === 0) return unchanged(state)
  const first = source[start]
  const targetTop = target.at(-1)
  if (!first || (targetTop && targetTop.card.rank !== first.card.rank + 1)) return unchanged(state)

  const tableau = state.tableau.map((column) => column.map((item) => ({ ...item })))
  const moving = tableau[from]?.splice(start, count) ?? []
  tableau[to]?.push(...moving)
  revealTop(tableau[from])
  return finish(state, tableau, state.stock, Math.max(0, state.score - 1))
}

export function dealStock(state: SpiderState): SpiderMoveResult {
  if (state.stock.length < 10 || state.tableau.some((column) => column.length === 0)) return unchanged(state)
  const tableau = state.tableau.map((column) => column.map((item) => ({ ...item })))
  const dealt = state.stock.slice(0, 10)
  dealt.forEach((card, index) => tableau[index]?.push({ card, faceUp: true }))
  return finish(state, tableau, state.stock.slice(10), Math.max(0, state.score - 1))
}

function finish(state: SpiderState, tableau: SpiderCard[][], stock: readonly Card[], baseScore: number): SpiderMoveResult {
  const removed = removeCompleteRuns(tableau)
  const completedRuns = state.completedRuns + removed
  return {
    moved: true,
    completed: removed,
    state: {
      tableau,
      stock,
      completedRuns,
      moves: state.moves + 1,
      score: baseScore + removed * 100,
      won: completedRuns === 8
    }
  }
}

function removeCompleteRuns(tableau: SpiderCard[][]): number {
  let removed = 0
  let found = true
  while (found) {
    found = false
    for (const column of tableau) {
      if (column.length < 13) continue
      const run = column.slice(-13)
      const complete = run.every((item, index) => item.faceUp && item.card.rank === 13 - index)
      if (!complete) continue
      column.splice(-13, 13)
      revealTop(column)
      removed += 1
      found = true
    }
  }
  return removed
}

function revealTop(column: SpiderCard[] | undefined): void {
  const top = column?.at(-1)
  if (top) top.faceUp = true
}

function unchanged(state: SpiderState): SpiderMoveResult {
  return { state, moved: false, completed: 0 }
}

function isColumn(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < 10
}

