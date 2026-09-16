import { shuffle, type RandomSource } from '../../cards/core/cards'
import { DIRECTIONS, OPPOSITE, neighbor } from '../../pipes/core/game'
export interface MazeState { size: number; passages: number[]; player: number; trail: number[]; won: boolean }
export function newGame(size = 5, random: RandomSource = Math.random): MazeState {
  if (![5, 7, 9, 11].includes(size)) throw new Error('无效尺寸')
  const passages = Array<number>(size * size).fill(0), visited = new Set([0]), stack = [0]
  while (stack.length) {
    const current = stack.at(-1)!
    const direction = shuffle([0, 1, 2, 3], random).find(d => { const n = neighbor(current, d, size); return n >= 0 && !visited.has(n) })
    if (direction === undefined) { stack.pop(); continue }
    const next = neighbor(current, direction, size)
    passages[current] = passages[current]! | DIRECTIONS[direction]!
    passages[next] = passages[next]! | OPPOSITE[direction]!
    visited.add(next); stack.push(next)
  }
  return { size, passages, player: 0, trail: [], won: false }
}
export function move(state: MazeState, direction: number): MazeState {
  if (state.won || !Number.isInteger(direction) || direction < 0 || direction > 3 || !(state.passages[state.player]! & DIRECTIONS[direction]!)) return state
  const player = neighbor(state.player, direction, state.size)
  if (player < 0) return state
  return { ...state, player, trail: [...state.trail, state.player], won: player === state.size * state.size - 1 }
}
export function undo(state: MazeState): MazeState {
  return state.trail.length ? { ...state, player: state.trail.at(-1)!, trail: state.trail.slice(0, -1), won: false } : state
}
export function path(state: MazeState): number[] {
  const queue = [[state.player]], seen = new Set([state.player])
  for (let i = 0; i < queue.length; i++) {
    const route = queue[i]!, current = route.at(-1)!
    if (current === state.size * state.size - 1) return route
    DIRECTIONS.forEach((bit, d) => {
      const next = neighbor(current, d, state.size)
      if (!(state.passages[current]! & bit) || next < 0 || seen.has(next)) return
      seen.add(next); queue.push([...route, next])
    })
  }
  return []
}
