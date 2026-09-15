import { shuffle, type RandomSource } from '../../cards/core/cards'

export type CellVisibility = 'hidden' | 'revealed' | 'flagged'
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost'

export interface MineCell {
  mine: boolean
  adjacent: number
  visibility: CellVisibility
}

export interface MinesweeperState {
  width: number
  height: number
  mineCount: number
  cells: readonly MineCell[]
  status: GameStatus
  remainingSafe: number
  explodedIndex: number | null
}

export interface RevealResult {
  state: MinesweeperState
  changed: boolean
}

export function newGame(width = 9, height = 9, mineCount = 10): MinesweeperState {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) throw new Error('无效的棋盘尺寸')
  if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > width * height - 9) throw new Error('无效的地雷数量')
  return {
    width,
    height,
    mineCount,
    cells: Array.from({ length: width * height }, () => ({ mine: false, adjacent: 0, visibility: 'hidden' as const })),
    status: 'ready',
    remainingSafe: width * height - mineCount,
    explodedIndex: null
  }
}

export function revealCell(state: MinesweeperState, index: number, random: RandomSource = Math.random): RevealResult {
  if (!isIndex(state, index) || state.status === 'won' || state.status === 'lost') return unchanged(state)
  if (state.cells[index]?.visibility !== 'hidden') return unchanged(state)
  const prepared = state.status === 'ready' ? placeMines(state, index, random) : state
  return revealPreparedCells(prepared, [index])
}

export function toggleFlag(state: MinesweeperState, index: number): RevealResult {
  if (!isIndex(state, index) || state.status === 'won' || state.status === 'lost') return unchanged(state)
  const cell = state.cells[index]
  if (!cell || cell.visibility === 'revealed') return unchanged(state)
  const cells = state.cells.map((item) => ({ ...item }))
  const target = cells[index]
  if (!target) return unchanged(state)
  target.visibility = target.visibility === 'flagged' ? 'hidden' : 'flagged'
  return { state: { ...state, cells }, changed: true }
}

export function chordCell(state: MinesweeperState, index: number): RevealResult {
  if (!isIndex(state, index) || state.status !== 'playing') return unchanged(state)
  const cell = state.cells[index]
  if (!cell || cell.visibility !== 'revealed' || cell.adjacent === 0) return unchanged(state)
  const neighbors = neighborIndices(state, index)
  const flags = neighbors.filter((neighbor) => state.cells[neighbor]?.visibility === 'flagged').length
  if (flags !== cell.adjacent) return unchanged(state)
  const hidden = neighbors.filter((neighbor) => state.cells[neighbor]?.visibility === 'hidden')
  return hidden.length > 0 ? revealPreparedCells(state, hidden) : unchanged(state)
}

export function remainingMines(state: MinesweeperState): number {
  return state.mineCount - state.cells.filter((cell) => cell.visibility === 'flagged').length
}

function placeMines(state: MinesweeperState, firstIndex: number, random: RandomSource): MinesweeperState {
  const excluded = new Set([firstIndex, ...neighborIndices(state, firstIndex)])
  const candidates = state.cells.flatMap((_cell, index) => excluded.has(index) ? [] : [index])
  const mineIndices = new Set(shuffle(candidates, random).slice(0, state.mineCount))
  const cells = state.cells.map((_cell, index) => ({
    mine: mineIndices.has(index),
    adjacent: 0,
    visibility: 'hidden' as CellVisibility
  }))
  cells.forEach((cell, index) => {
    if (!cell.mine) cell.adjacent = neighborIndices(state, index).filter((neighbor) => mineIndices.has(neighbor)).length
  })
  return { ...state, cells, status: 'playing' }
}

function revealPreparedCells(state: MinesweeperState, startingIndices: readonly number[]): RevealResult {
  const cells = state.cells.map((cell) => ({ ...cell }))
  const queue = [...startingIndices]
  const queued = new Set(queue)
  let remainingSafe = state.remainingSafe
  let changed = false

  while (queue.length > 0) {
    const index = queue.shift()
    if (index === undefined) continue
    const cell = cells[index]
    if (!cell || cell.visibility !== 'hidden') continue
    if (cell.mine) {
      cell.visibility = 'revealed'
      return {
        changed: true,
        state: { ...state, cells: revealAllMines(cells), status: 'lost', explodedIndex: index }
      }
    }
    cell.visibility = 'revealed'
    remainingSafe -= 1
    changed = true
    if (cell.adjacent === 0) {
      for (const neighbor of neighborIndices(state, index)) {
        if (!queued.has(neighbor) && cells[neighbor]?.visibility === 'hidden') {
          queued.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
  }

  const won = remainingSafe === 0
  return {
    changed,
    state: {
      ...state,
      cells: won ? flagAllMines(cells) : cells,
      status: won ? 'won' : state.status,
      remainingSafe
    }
  }
}

function revealAllMines(cells: MineCell[]): MineCell[] {
  return cells.map((cell) => cell.mine ? { ...cell, visibility: 'revealed' } : cell)
}

function flagAllMines(cells: MineCell[]): MineCell[] {
  return cells.map((cell) => cell.mine ? { ...cell, visibility: 'flagged' } : cell)
}

function neighborIndices(state: Pick<MinesweeperState, 'width' | 'height'>, index: number): number[] {
  const row = Math.floor(index / state.width)
  const column = index % state.width
  const result: number[] = []
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue
      const nextRow = row + rowOffset
      const nextColumn = column + columnOffset
      if (nextRow >= 0 && nextRow < state.height && nextColumn >= 0 && nextColumn < state.width) {
        result.push(nextRow * state.width + nextColumn)
      }
    }
  }
  return result
}

function isIndex(state: MinesweeperState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < state.cells.length
}

function unchanged(state: MinesweeperState): RevealResult {
  return { state, changed: false }
}

