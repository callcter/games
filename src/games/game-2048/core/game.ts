export const BOARD_SIZE = 4
export const WINNING_TILE = 2048

export type Direction = 'up' | 'down' | 'left' | 'right'
export type Board = readonly number[]

export interface Game2048State {
  board: Board
  score: number
  bestScore: number
  gameOver: boolean
  won: boolean
}

export interface MoveResult {
  board: Board
  scoreGain: number
  moved: boolean
}

export type RandomSource = () => number

const emptyBoard = (): number[] => Array<number>(BOARD_SIZE * BOARD_SIZE).fill(0)

export function newGame(bestScore = 0, random: RandomSource = Math.random): Game2048State {
  const board = spawnTile(spawnTile(emptyBoard(), random), random)
  return { board, score: 0, bestScore, gameOver: false, won: false }
}

export function moveGame(
  state: Game2048State,
  direction: Direction,
  random: RandomSource = Math.random
): { state: Game2048State; moved: boolean } {
  if (state.gameOver) return { state, moved: false }

  const result = moveBoard(state.board, direction)
  if (!result.moved) return { state, moved: false }

  const board = spawnTile(result.board, random)
  const score = state.score + result.scoreGain

  return {
    moved: true,
    state: {
      board,
      score,
      bestScore: Math.max(state.bestScore, score),
      won: state.won || board.some((tile) => tile >= WINNING_TILE),
      gameOver: !hasAvailableMove(board)
    }
  }
}

export function moveBoard(board: Board, direction: Direction): MoveResult {
  assertBoard(board)
  const next = [...board]
  let scoreGain = 0

  for (let lineIndex = 0; lineIndex < BOARD_SIZE; lineIndex += 1) {
    const indices = lineIndices(direction, lineIndex)
    const line = indices.map((index) => board[index] ?? 0)
    const collapsed = collapseLine(line)
    scoreGain += collapsed.scoreGain
    indices.forEach((index, position) => {
      next[index] = collapsed.line[position] ?? 0
    })
  }

  return {
    board: next,
    scoreGain,
    moved: next.some((tile, index) => tile !== board[index])
  }
}

export function spawnTile(board: Board, random: RandomSource = Math.random): Board {
  assertBoard(board)
  const emptyIndices = board
    .map((tile, index) => (tile === 0 ? index : -1))
    .filter((index) => index >= 0)

  if (emptyIndices.length === 0) return [...board]

  const choice = Math.min(Math.floor(normalizeRandom(random()) * emptyIndices.length), emptyIndices.length - 1)
  const index = emptyIndices[choice]
  if (index === undefined) return [...board]

  const next = [...board]
  next[index] = normalizeRandom(random()) < 0.9 ? 2 : 4
  return next
}

export function hasAvailableMove(board: Board): boolean {
  assertBoard(board)
  if (board.includes(0)) return true

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const index = row * BOARD_SIZE + column
      const value = board[index]
      if (column + 1 < BOARD_SIZE && value === board[index + 1]) return true
      if (row + 1 < BOARD_SIZE && value === board[index + BOARD_SIZE]) return true
    }
  }
  return false
}

export function restoreGame(value: unknown): Game2048State | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Game2048State>
  if (!Array.isArray(candidate.board) || candidate.board.length !== BOARD_SIZE * BOARD_SIZE) return null
  if (!candidate.board.every(isValidTile)) return null
  if (!isNonNegativeNumber(candidate.score) || !isNonNegativeNumber(candidate.bestScore)) return null
  if (typeof candidate.gameOver !== 'boolean' || typeof candidate.won !== 'boolean') return null

  return {
    board: [...candidate.board],
    score: candidate.score,
    bestScore: Math.max(candidate.score, candidate.bestScore),
    gameOver: candidate.gameOver,
    won: candidate.won
  }
}

function collapseLine(line: readonly number[]): { line: number[]; scoreGain: number } {
  const values = line.filter((tile) => tile !== 0)
  const merged: number[] = []
  let scoreGain = 0

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? 0
    if (value !== 0 && value === values[index + 1]) {
      const combined = value * 2
      merged.push(combined)
      scoreGain += combined
      index += 1
    } else {
      merged.push(value)
    }
  }

  while (merged.length < BOARD_SIZE) merged.push(0)
  return { line: merged, scoreGain }
}

function lineIndices(direction: Direction, line: number): number[] {
  const forward = Array.from({ length: BOARD_SIZE }, (_, index) => index)
  const reverse = [...forward].reverse()

  switch (direction) {
    case 'left': return forward.map((column) => line * BOARD_SIZE + column)
    case 'right': return reverse.map((column) => line * BOARD_SIZE + column)
    case 'up': return forward.map((row) => row * BOARD_SIZE + line)
    case 'down': return reverse.map((row) => row * BOARD_SIZE + line)
  }
}

function assertBoard(board: Board): void {
  if (board.length !== BOARD_SIZE * BOARD_SIZE || !board.every(isValidTile)) {
    throw new Error('无效的 2048 棋盘')
  }
}

function isValidTile(value: unknown): value is number {
  if (value === 0) return true
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 2) return false
  return (value & (value - 1)) === 0
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 0.999999999999))
}

