export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export const PIECE_TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'] as const
export type PieceType = typeof PIECE_TYPES[number]
export type Cell = PieceType | null
export type Board = readonly Cell[]

export interface ActivePiece {
  type: PieceType
  rotation: number
  row: number
  column: number
}

export interface TetrisState {
  board: Board
  active: ActivePiece
  nextQueue: readonly PieceType[]
  holdType: PieceType | null
  canHold: boolean
  bag: readonly PieceType[]
  score: number
  lines: number
  level: number
  gameOver: boolean
}

export interface ActionResult {
  state: TetrisState
  changed: boolean
  locked: boolean
  clearedLines: number
}

export type RandomSource = () => number
type Coordinate = readonly [column: number, row: number]

const SHAPES: Record<PieceType, readonly (readonly Coordinate[])[]> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]]
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]]
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]]
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]]
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]]
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]]
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]]
  ]
}

const JLSTZ_KICKS: Record<string, readonly Coordinate[]> = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
}

const I_KICKS: Record<string, readonly Coordinate[]> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
}

export function newGame(random: RandomSource = Math.random): TetrisState {
  const firstBag = shuffledBag(random)
  const activeType = firstBag[0] ?? 'T'
  return {
    board: Array<Cell>(BOARD_WIDTH * BOARD_HEIGHT).fill(null),
    active: spawnPiece(activeType),
    nextQueue: firstBag.slice(1, 6),
    holdType: null,
    canHold: true,
    bag: firstBag.slice(6),
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false
  }
}

export function moveHorizontal(state: TetrisState, offset: -1 | 1): ActionResult {
  if (state.gameOver) return unchanged(state)
  const active = { ...state.active, column: state.active.column + offset }
  if (!canPlace(state.board, active)) return unchanged(state)
  return changed({ ...state, active })
}

export function rotatePiece(state: TetrisState, direction: -1 | 1 = 1): ActionResult {
  if (state.gameOver || state.active.type === 'O') return unchanged(state)
  const fromRotation = modulo(state.active.rotation, 4)
  const rotation = modulo(fromRotation + direction, 4)
  const kicks = (state.active.type === 'I' ? I_KICKS : JLSTZ_KICKS)[`${fromRotation}>${rotation}`] ?? [[0, 0]]
  for (const [columnKick, rowKick] of kicks) {
    const active = {
      ...state.active,
      rotation,
      column: state.active.column + columnKick,
      row: state.active.row + rowKick
    }
    if (canPlace(state.board, active)) return changed({ ...state, active })
  }
  return unchanged(state)
}

export function tick(state: TetrisState): ActionResult {
  return moveDown(state, false)
}

export function softDrop(state: TetrisState): ActionResult {
  return moveDown(state, true)
}

export function hardDrop(state: TetrisState, random: RandomSource = Math.random): ActionResult {
  if (state.gameOver) return unchanged(state)
  let distance = 0
  let active = state.active
  while (canPlace(state.board, { ...active, row: active.row + 1 })) {
    active = { ...active, row: active.row + 1 }
    distance += 1
  }
  return lockPiece({ ...state, active, score: state.score + distance * 2 }, random)
}

export function holdPiece(state: TetrisState, random: RandomSource = Math.random): ActionResult {
  if (state.gameOver || !state.canHold) return unchanged(state)

  if (state.holdType) {
    const active = spawnPiece(state.holdType)
    return changed({
      ...state,
      active,
      holdType: state.active.type,
      canHold: false,
      gameOver: !canPlace(state.board, active)
    })
  }

  const nextType = state.nextQueue[0]
  if (!nextType) return unchanged(state)
  const drawn = takeFromBag(state.bag, random)
  const active = spawnPiece(nextType)
  return changed({
    ...state,
    active,
    nextQueue: [...state.nextQueue.slice(1), drawn.type],
    holdType: state.active.type,
    canHold: false,
    bag: drawn.bag,
    gameOver: !canPlace(state.board, active)
  })
}

export function isGrounded(state: TetrisState): boolean {
  return !canPlace(state.board, { ...state.active, row: state.active.row + 1 })
}

export function lockActivePiece(state: TetrisState, random: RandomSource = Math.random): ActionResult {
  if (state.gameOver) return unchanged(state)
  return lockPiece(state, random)
}

export function ghostRow(state: TetrisState): number {
  let row = state.active.row
  while (canPlace(state.board, { ...state.active, row: row + 1 })) row += 1
  return row
}

export function pieceCells(piece: ActivePiece): Array<{ row: number; column: number }> {
  const rotations = SHAPES[piece.type]
  const shape = rotations[modulo(piece.rotation, rotations.length)] ?? rotations[0] ?? []
  return shape.map(([column, row]) => ({ row: piece.row + row, column: piece.column + column }))
}

function moveDown(state: TetrisState, addSoftDropScore: boolean): ActionResult {
  if (state.gameOver) return unchanged(state)
  const active = { ...state.active, row: state.active.row + 1 }
  if (canPlace(state.board, active)) {
    return changed({ ...state, active, score: state.score + (addSoftDropScore ? 1 : 0) })
  }
  return unchanged(state)
}

function lockPiece(state: TetrisState, random: RandomSource = Math.random): ActionResult {
  const board = [...state.board]
  for (const cell of pieceCells(state.active)) {
    if (cell.row < 0) return { ...unchanged({ ...state, gameOver: true }), changed: true, locked: true }
    board[cell.row * BOARD_WIDTH + cell.column] = state.active.type
  }

  const cleared = clearCompleteLines(board)
  const lines = state.lines + cleared.count
  const level = Math.floor(lines / 10) + 1
  const bagResult = takeFromBag(state.bag, random)
  const nextType = state.nextQueue[0] ?? bagResult.type
  const active = spawnPiece(nextType)
  const nextState: TetrisState = {
    ...state,
    board: cleared.board,
    active,
    nextQueue: [...state.nextQueue.slice(1), bagResult.type],
    canHold: true,
    bag: bagResult.bag,
    score: state.score + lineScore(cleared.count) * state.level,
    lines,
    level,
    gameOver: !canPlace(cleared.board, active)
  }
  return { state: nextState, changed: true, locked: true, clearedLines: cleared.count }
}

function clearCompleteLines(board: Board): { board: Board; count: number } {
  const rows: Cell[][] = []
  let count = 0
  for (let row = 0; row < BOARD_HEIGHT; row += 1) {
    const cells = board.slice(row * BOARD_WIDTH, (row + 1) * BOARD_WIDTH)
    if (cells.every((cell) => cell !== null)) count += 1
    else rows.push([...cells])
  }
  while (rows.length < BOARD_HEIGHT) rows.unshift(Array<Cell>(BOARD_WIDTH).fill(null))
  return { board: rows.flat(), count }
}

function canPlace(board: Board, piece: ActivePiece): boolean {
  return pieceCells(piece).every(({ row, column }) => {
    if (column < 0 || column >= BOARD_WIDTH || row >= BOARD_HEIGHT) return false
    return row < 0 || board[row * BOARD_WIDTH + column] === null
  })
}

function spawnPiece(type: PieceType): ActivePiece {
  return { type, rotation: 0, row: 0, column: 3 }
}

function takeFromBag(bag: readonly PieceType[], random: RandomSource): { type: PieceType; bag: PieceType[] } {
  const source = bag.length === 0 ? shuffledBag(random) : [...bag]
  return { type: source[0] ?? 'T', bag: source.slice(1) }
}

function shuffledBag(random: RandomSource): PieceType[] {
  const bag = [...PIECE_TYPES]
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const choice = Math.floor(normalizeRandom(random()) * (index + 1))
    const value = bag[index]
    const other = bag[choice]
    if (value !== undefined && other !== undefined) {
      bag[index] = other
      bag[choice] = value
    }
  }
  return bag
}

function lineScore(lines: number): number {
  return [0, 100, 300, 500, 800][lines] ?? 0
}

function changed(state: TetrisState): ActionResult {
  return { state, changed: true, locked: false, clearedLines: 0 }
}

function unchanged(state: TetrisState): ActionResult {
  return { state, changed: false, locked: false, clearedLines: 0 }
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 0.999999999999))
}
