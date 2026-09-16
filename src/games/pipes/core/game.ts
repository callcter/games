import { shuffle, type RandomSource } from '../../cards/core/cards'

export const DIRECTIONS = [1, 2, 4, 8] as const
export const OPPOSITE = [4, 8, 1, 2] as const
export function neighbor(index: number, direction: number, size: number): number {
  const x = index % size, y = Math.floor(index / size)
  const nx = x + [0, 1, 0, -1][direction]!, ny = y + [-1, 0, 1, 0][direction]!
  return nx < 0 || ny < 0 || nx >= size || ny >= size ? -1 : ny * size + nx
}
export function rotate(mask: number): number { return ((mask << 1) & 15) | (mask >> 3) }
export interface PipesState { size: number; cells: number[]; solution: number[]; moves: number }

export function newGame(size = 4, random: RandomSource = Math.random): PipesState {
  if (![3, 4, 5].includes(size)) throw new Error('无效尺寸')
  const solution = Array<number>(size * size).fill(0), seen = new Set([0])
  const visit = (index: number): void => {
    for (const direction of shuffle([0, 1, 2, 3], random)) {
      const next = neighbor(index, direction, size)
      if (next < 0 || seen.has(next)) continue
      seen.add(next)
      solution[index] = solution[index]! | DIRECTIONS[direction]!
      solution[next] = solution[next]! | OPPOSITE[direction]!
      visit(next)
    }
  }
  visit(0)
  const cells = solution.map(mask => {
    const count = shuffle([0, 1, 2, 3], random)[0]!
    for (let i = 0; i < count; i++) mask = rotate(mask)
    return mask
  })
  if (cells.every((mask, i) => mask === solution[i])) cells[0] = rotate(cells[0]!)
  return { size, cells, solution, moves: 0 }
}

export function connected(state: PipesState): Set<number> {
  const reached = new Set([0]), queue = [0]
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]!
    DIRECTIONS.forEach((bit, direction) => {
      const next = neighbor(index, direction, state.size)
      if (next < 0 || reached.has(next) || !(state.cells[index]! & bit) || !(state.cells[next]! & OPPOSITE[direction]!)) return
      reached.add(next); queue.push(next)
    })
  }
  return reached
}
export function won(state: PipesState): boolean { return connected(state).size === state.cells.length }
export function turn(state: PipesState, index: number): PipesState {
  if (won(state) || !Number.isInteger(index) || index < 0 || index >= state.cells.length) return state
  return { ...state, moves: state.moves + 1, cells: state.cells.map((mask, i) => i === index ? rotate(mask) : mask) }
}
