import { shuffle, type RandomSource } from '../../cards/core/cards'

export interface MemoryState {
  cards: number[]
  open: number[]
  matched: number[]
  turns: number
  player: number
  scores: number[]
  won: boolean
}

export function newGame(pairs = 8, players = 1, random: RandomSource = Math.random): MemoryState {
  if (![8, 12, 16, 24].includes(pairs) || ![1, 2].includes(players)) throw new Error('无效难度')
  return { cards: shuffle(Array.from({ length: pairs * 2 }, (_, i) => i % pairs), random), open: [], matched: [], turns: 0, player: 0, scores: Array(players).fill(0), won: false }
}

export function flip(state: MemoryState, index: number): MemoryState {
  if (state.won || !Number.isInteger(index) || index < 0 || index >= state.cards.length || state.open.length === 2 || state.open.includes(index) || state.matched.includes(index)) return state
  const open = [...state.open, index]
  if (open.length === 1) return { ...state, open }
  const turns = state.turns + 1
  if (state.cards[open[0]!] !== state.cards[index]) return { ...state, open, turns }
  const matched = [...state.matched, ...open]
  const scores = state.scores.map((score, player) => score + (player === state.player ? 1 : 0))
  return { ...state, open: [], matched, scores, turns, won: matched.length === state.cards.length }
}

export function conceal(state: MemoryState): MemoryState {
  return state.open.length === 2 ? { ...state, open: [], player: (state.player + 1) % state.scores.length } : state
}
