export const BOARD_SIZE = 15
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE

export type Cell = 0 | 1 | 2
export type Player = 1 | 2
export type Board = readonly Cell[]

export interface GomokuState {
  board: Board
  currentPlayer: Player
  winner: Player | null
  winningLine: readonly number[]
  draw: boolean
  moveCount: number
  lastMove: number | null
}

export interface PlaceResult {
  state: GomokuState
  placed: boolean
}

export type RandomSource = () => number

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
] as const

export function newGame(): GomokuState {
  return {
    board: Array<Cell>(CELL_COUNT).fill(0),
    currentPlayer: 1,
    winner: null,
    winningLine: [],
    draw: false,
    moveCount: 0,
    lastMove: null
  }
}

export function placeStone(state: GomokuState, index: number): PlaceResult {
  if (state.winner || state.draw || !isBoardIndex(index) || state.board[index] !== 0) {
    return { state, placed: false }
  }

  const board = [...state.board]
  board[index] = state.currentPlayer
  const winningLine = findWinningLine(board, index, state.currentPlayer)
  const moveCount = state.moveCount + 1
  const winner = winningLine.length >= 5 ? state.currentPlayer : null

  return {
    placed: true,
    state: {
      board,
      currentPlayer: state.currentPlayer === 1 ? 2 : 1,
      winner,
      winningLine,
      draw: winner === null && moveCount === CELL_COUNT,
      moveCount,
      lastMove: index
    }
  }
}

export function chooseComputerMove(
  board: Board,
  computer: Player = 2,
  random: RandomSource = Math.random
): number | null {
  assertBoard(board)
  const empty = board.flatMap((cell, index) => cell === 0 ? [index] : [])
  if (empty.length === 0) return null
  if (empty.length === CELL_COUNT) return centerIndex()

  const opponent: Player = computer === 1 ? 2 : 1
  const candidates = empty.filter((index) => hasNearbyStone(board, index, 2))

  const winningMove = candidates.find((index) => isWinningMove(board, index, computer))
  if (winningMove !== undefined) return winningMove

  const blockingMove = candidates.find((index) => isWinningMove(board, index, opponent))
  if (blockingMove !== undefined) return blockingMove

  let bestScore = Number.NEGATIVE_INFINITY
  let bestMoves: number[] = []
  for (const index of candidates) {
    const score = scoreCandidate(board, index, computer, opponent)
    if (score > bestScore) {
      bestScore = score
      bestMoves = [index]
    } else if (score === bestScore) {
      bestMoves.push(index)
    }
  }

  const choice = Math.min(Math.floor(normalizeRandom(random()) * bestMoves.length), bestMoves.length - 1)
  return bestMoves[choice] ?? candidates[0] ?? empty[0] ?? null
}

export function toIndex(row: number, column: number): number {
  return row * BOARD_SIZE + column
}

function findWinningLine(board: Board, index: number, player: Player): number[] {
  const row = Math.floor(index / BOARD_SIZE)
  const column = index % BOARD_SIZE

  for (const [rowStep, columnStep] of DIRECTIONS) {
    const before = collectDirection(board, row, column, -rowStep, -columnStep, player).reverse()
    const after = collectDirection(board, row, column, rowStep, columnStep, player)
    const line = [...before, index, ...after]
    if (line.length >= 5) return line
  }
  return []
}

function collectDirection(
  board: Board,
  startRow: number,
  startColumn: number,
  rowStep: number,
  columnStep: number,
  player: Player
): number[] {
  const indices: number[] = []
  let row = startRow + rowStep
  let column = startColumn + columnStep
  while (isCoordinate(row, column)) {
    const index = toIndex(row, column)
    if (board[index] !== player) break
    indices.push(index)
    row += rowStep
    column += columnStep
  }
  return indices
}

function isWinningMove(board: Board, index: number, player: Player): boolean {
  const candidate = [...board]
  candidate[index] = player
  return findWinningLine(candidate, index, player).length >= 5
}

function scoreCandidate(board: Board, index: number, computer: Player, opponent: Player): number {
  const row = Math.floor(index / BOARD_SIZE)
  const column = index % BOARD_SIZE
  let score = 0

  for (const [rowStep, columnStep] of DIRECTIONS) {
    const own = countAround(board, row, column, rowStep, columnStep, computer)
    const threat = countAround(board, row, column, rowStep, columnStep, opponent)
    score += own * own * 24 + threat * threat * 20
  }

  const center = (BOARD_SIZE - 1) / 2
  score -= (Math.abs(row - center) + Math.abs(column - center)) * 0.15
  return score
}

function countAround(
  board: Board,
  row: number,
  column: number,
  rowStep: number,
  columnStep: number,
  player: Player
): number {
  return countOneWay(board, row, column, rowStep, columnStep, player)
    + countOneWay(board, row, column, -rowStep, -columnStep, player)
}

function countOneWay(
  board: Board,
  startRow: number,
  startColumn: number,
  rowStep: number,
  columnStep: number,
  player: Player
): number {
  let count = 0
  let row = startRow + rowStep
  let column = startColumn + columnStep
  while (isCoordinate(row, column) && board[toIndex(row, column)] === player) {
    count += 1
    row += rowStep
    column += columnStep
  }
  return count
}

function hasNearbyStone(board: Board, index: number, distance: number): boolean {
  const row = Math.floor(index / BOARD_SIZE)
  const column = index % BOARD_SIZE
  for (let rowOffset = -distance; rowOffset <= distance; rowOffset += 1) {
    for (let columnOffset = -distance; columnOffset <= distance; columnOffset += 1) {
      const nearbyRow = row + rowOffset
      const nearbyColumn = column + columnOffset
      if (isCoordinate(nearbyRow, nearbyColumn) && board[toIndex(nearbyRow, nearbyColumn)] !== 0) return true
    }
  }
  return false
}

function assertBoard(board: Board): void {
  if (board.length !== CELL_COUNT || !board.every((cell) => cell === 0 || cell === 1 || cell === 2)) {
    throw new Error('无效的五子棋棋盘')
  }
}

function centerIndex(): number {
  const center = Math.floor(BOARD_SIZE / 2)
  return toIndex(center, center)
}

function isCoordinate(row: number, column: number): boolean {
  return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE
}

function isBoardIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < CELL_COUNT
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 0.999999999999))
}

