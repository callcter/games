import { shuffle, type RandomSource } from '../../cards/core/cards'

export type SudokuSize = 4 | 6 | 9
export const SIZES: readonly SudokuSize[] = [4, 6, 9]

// 每档的目标挖空数；实际可挖数量受唯一解约束，可能略少。
export const PUZZLE_BLANKS: Record<SudokuSize, number> = { 4: 8, 6: 16, 9: 40 }

export interface SudokuState {
  size: SudokuSize
  /** 题面：0 表示该格由玩家填写，大于 0 为固定数字。 */
  puzzle: number[]
  /** 当前盘面，包含题面数字。 */
  values: number[]
  /** 唯一完整解，提示功能使用。 */
  solution: number[]
  won: boolean
}

function boxOf(size: number): { rows: number; cols: number } {
  return size === 4 ? { rows: 2, cols: 2 } : size === 6 ? { rows: 2, cols: 3 } : { rows: 3, cols: 3 }
}

/** 返回同行、同列或同宫内数字重复的所有格。 */
export function conflicts(values: readonly number[], size: number): Set<number> {
  const result = new Set<number>()
  const { rows: boxRows, cols: boxCols } = boxOf(size)
  const check = (indices: number[]): void => {
    const positions = new Map<number, number[]>()
    for (const index of indices) {
      const value = values[index]!
      if (!value) continue
      const list = positions.get(value) ?? []
      list.push(index); positions.set(value, list)
    }
    for (const list of positions.values()) if (list.length > 1) list.forEach(index => result.add(index))
  }
  for (let r = 0; r < size; r++) check(Array.from({ length: size }, (_, c) => r * size + c))
  for (let c = 0; c < size; c++) check(Array.from({ length: size }, (_, r) => r * size + c))
  const boxes = Math.floor(size / boxRows) * Math.floor(size / boxCols)
  for (let box = 0; box < boxes; box++) {
    const baseRow = Math.floor(box / (size / boxCols)) * boxRows
    const baseCol = box % (size / boxCols) * boxCols
    check(Array.from({ length: boxRows * boxCols }, (_, i) => (baseRow + Math.floor(i / boxCols)) * size + baseCol + i % boxCols))
  }
  return result
}

function candidatesOf(values: readonly number[], size: number, index: number): number[] {
  const { rows: boxRows, cols: boxCols } = boxOf(size)
  const row = Math.floor(index / size), col = index % size
  const baseRow = Math.floor(row / boxRows) * boxRows, baseCol = Math.floor(col / boxCols) * boxCols
  const used = new Set<number>()
  for (let i = 0; i < size; i++) {
    used.add(values[row * size + i]!)
    used.add(values[i * size + col]!)
  }
  for (let r = 0; r < boxRows; r++) for (let c = 0; c < boxCols; c++) used.add(values[(baseRow + r) * size + baseCol + c]!)
  return Array.from({ length: size }, (_, i) => i + 1).filter(value => !used.has(value))
}

/** 回溯数解（默认最多 2 个），用于保证生成题面唯一解；不在每次点击时执行。 */
export function countSolutions(values: readonly number[], size: number, limit = 2): number {
  const grid = [...values]
  let count = 0
  const search = (): boolean => {
    let best = -1, options: number[] | null = null
    for (let i = 0; i < grid.length; i++) {
      if (grid[i]) continue
      const current = candidatesOf(grid, size, i)
      if (!options || current.length < options.length) { best = i; options = current }
      if (current.length <= 1) break
    }
    if (best < 0) { count++; return count >= limit }
    for (const value of options!) {
      grid[best] = value
      if (search()) { grid[best] = 0; return true }
      grid[best] = 0
    }
    return false
  }
  search()
  return count
}

function fullSolution(size: number, random: RandomSource): number[] {
  const grid = Array<number>(size * size).fill(0)
  const fill = (index: number): boolean => {
    if (index === grid.length) return true
    for (const value of shuffle(candidatesOf(grid, size, index), random)) {
      grid[index] = value
      if (fill(index + 1)) return true
      grid[index] = 0
    }
    return false
  }
  fill(0)
  return grid
}

export function newGame(size: SudokuSize = 9, random: RandomSource = Math.random): SudokuState {
  if (!SIZES.includes(size)) throw new Error('无效难度')
  const solution = fullSolution(size, random)
  const values = [...solution]
  let blanks = 0
  for (const index of shuffle(Array.from({ length: values.length }, (_, i) => i), random)) {
    if (blanks >= PUZZLE_BLANKS[size]) break
    const kept = values[index]!
    values[index] = 0
    if (countSolutions(values, size) !== 1) values[index] = kept
    else blanks++
  }
  return { size, puzzle: [...values], values, solution, won: false }
}

export function place(state: SudokuState, index: number, value: number): SudokuState {
  if (state.won || !Number.isInteger(index) || index < 0 || index >= state.values.length
    || state.puzzle[index] !== 0 || !Number.isInteger(value) || value < 0 || value > state.size) return state
  if (state.values[index] === value) return state
  const values = state.values.map((old, i) => i === index ? value : old)
  const won = values.every(current => current > 0) && conflicts(values, state.size).size === 0
  return { ...state, values, won }
}
