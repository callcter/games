import { conflicts, countSolutions, SIZES, type SudokuState, type SudokuSize } from '../../sudoku/core/game'
import { newGame as nonogram, PATTERNS, solution, type NonogramState, type Mark } from '../../nonogram/core/game'
import { newGame as sokoban, LEVELS, type SokobanState } from '../../sokoban/core/game'
import { MODES as waterModes, TUBE_CAPACITY, topRun, type WaterState } from '../../water-sort/core/game'
import { MODES as parkingModes, SIZE as PARK_SIZE, EXIT_ROW, type ParkState } from '../../parking/core/game'

export interface Draft<T> { state: T; history: T[]; assisted: boolean }
export interface SokobanDraft extends Draft<SokobanState> { level: number }
export interface WaterSortDraft { state: WaterState; history: WaterState[]; mode: number }
export interface ParkingDraft { state: ParkState; history: ParkState[]; mode: number }
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const numbers = (value: unknown, length: number, min: number, max: number): value is number[] => Array.isArray(value) && value.length === length && value.every(n => Number.isInteger(n) && n >= min && n <= max)
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function sudokuState(value: unknown, validateUnique = true): SudokuState | null {
  const s = object(value), size = s.size as SudokuSize
  if (!SIZES.includes(size) || !numbers(s.puzzle, size*size, 0, size) || !numbers(s.values, size*size, 0, size)
    || !numbers(s.solution, size*size, 1, size) || conflicts(s.solution, size).size
    || s.puzzle.some((v,i) => v !== 0 && (v !== (s.solution as number[])[i] || v !== (s.values as number[])[i]))
    || (validateUnique && countSolutions(s.puzzle, size) !== 1)) return null
  const rawNotes = Array.isArray(s.notes) ? s.notes : []
  const notes = s.values.map((value,i) => !value && Array.isArray(rawNotes[i]) ? [...new Set<number>(rawNotes[i].filter((n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= size))].sort((a,b) => a-b) : [])
  return { size, puzzle: [...s.puzzle], values: [...s.values], solution: [...s.solution], notes, won: s.values.every(v => v > 0) && conflicts(s.values, size).size === 0 }
}

function nonogramState(value: unknown): NonogramState | null {
  const s = object(value)
  if (!Number.isInteger(s.level) || (s.level as number) < 0 || (s.level as number) >= PATTERNS.length) return null
  const state = nonogram(s.level as number), target = solution(state.level)
  if (!numbers(s.marks, state.marks.length, -1, 1)) return null
  const marks = [...s.marks] as Mark[]
  return { ...state, marks, won: target.every((v,i) => (v === 1) === (marks[i] === 1)) }
}

function sokobanState(value: unknown, level: number): SokobanState | null {
  const s = object(value), original = sokoban(level), total = original.width * original.height
  if (s.width !== original.width || s.height !== original.height || !equal(s.walls, original.walls) || !equal(s.goals, original.goals)
    || !numbers(s.boxes, original.boxes.length, 0, total - 1) || new Set(s.boxes).size !== s.boxes.length
    || s.boxes.some(box => original.walls.includes(box)) || !Number.isInteger(s.player) || (s.player as number) < 0 || (s.player as number) >= total
    || original.walls.includes(s.player as number) || s.boxes.includes(s.player as number) || !Number.isSafeInteger(s.moves) || (s.moves as number) < 0) return null
  return { ...original, boxes: [...s.boxes], player: s.player as number, moves: s.moves as number, won: s.boxes.every(box => original.goals.includes(box)) }
}

function restore<T>(value: unknown, parse: (value: unknown) => T | null, compatible: (a: T,b: T) => boolean): Draft<T> | null {
  const saved = object(value), state = parse(saved.state)
  if (!state) return null
  const history = (Array.isArray(saved.history) ? saved.history.slice(-50) : []).flatMap(value => {
    const entry = parse(value)
    return entry && compatible(state, entry) ? [entry] : []
  })
  return { state, history, assisted: saved.assisted === true }
}
export function restoreSudoku(value: unknown): Draft<SudokuState> | null {
  const saved = object(value), state = sudokuState(saved.state)
  if (!state) return null
  return restore({ ...saved, state }, value => sudokuState(value, false), (a,b) => a.size === b.size && equal(a.puzzle,b.puzzle) && equal(a.solution,b.solution))
}
export const restoreNonogram = (value: unknown): Draft<NonogramState> | null => restore(value, nonogramState, (a,b) => a.level === b.level)

function waterState(value: unknown, colors: number): WaterState | null {
  const s = object(value)
  if (!Array.isArray(s.tubes)) return null
  const tubes = (s.tubes as unknown[]).map((tube): number[] | null => {
    if (!Array.isArray(tube) || tube.length > TUBE_CAPACITY) return null
    return tube.every((layer): layer is number => Number.isInteger(layer) && layer >= 0 && layer < colors) ? tube : null
  })
  if (tubes.some(tube => tube === null)) return null
  const layers = tubes.flat()
  if (layers.length !== colors * TUBE_CAPACITY) return null
  for (let color = 0; color < colors; color++) if (layers.filter(layer => layer === color).length !== TUBE_CAPACITY) return null
  const moves = Number.isSafeInteger(s.moves) && (s.moves as number) >= 0 ? s.moves as number : 0
  const uniform = (tube: number[]): boolean => tube.length === TUBE_CAPACITY && topRun(tube) === TUBE_CAPACITY
  return { tubes: tubes as number[][], colors, moves, won: (tubes as number[][]).every(tube => !tube.length || uniform(tube)) }
}
function parkState(value: unknown, carCount: number): ParkState | null {
  const s = object(value)
  if (!Array.isArray(s.cars) || s.cars.length !== carCount) return null
  const cars = (s.cars as unknown[]).flatMap((raw): ParkState['cars'] => {
    const car = object(raw)
    const len = car.len === 2 || car.len === 3 ? car.len : 0
    if (!len || !Number.isInteger(car.id) || !Number.isInteger(car.x) || !Number.isInteger(car.y)
      || (car.x as number) < 0 || (car.x as number) >= PARK_SIZE || (car.y as number) < 0 || (car.y as number) >= PARK_SIZE
      || typeof car.horizontal !== 'boolean') return []
    return [{ id: car.id as number, x: car.x as number, y: car.y as number, len, horizontal: car.horizontal }]
  })
  if (cars.length !== carCount) return null
  const cells = cars.flatMap(car => Array.from({ length: car.len }, (_, i) => car.horizontal ? car.y * PARK_SIZE + car.x + i : (car.y + i) * PARK_SIZE + car.x))
  if (new Set(cells).size !== cells.length) return null
  if (cars[0]!.y !== EXIT_ROW || !cars[0]!.horizontal) return null
  const moves = Number.isSafeInteger(s.moves) && (s.moves as number) >= 0 ? s.moves as number : 0
  return { cars, moves, won: s.won === true }
}
export function restoreParking(value: unknown): ParkingDraft | null {
  const saved = object(value)
  const mode = saved.mode
  if (!Number.isInteger(mode) || (mode as number) < 0 || (mode as number) >= parkingModes.length) return null
  const config = parkingModes[mode as number]!
  const state = parkState(saved.state, config.cars)
  if (!state) return null
  const history = (Array.isArray(saved.history) ? saved.history.slice(-50) : [])
    .map((entry: unknown) => parkState(entry, config.cars))
    .flatMap((entry): ParkState[] => entry ? [entry] : [])
  return { state, history, mode: mode as number }
}

export function restoreWaterSort(value: unknown): WaterSortDraft | null {
  const saved = object(value)
  const mode = saved.mode
  if (!Number.isInteger(mode) || (mode as number) < 0 || (mode as number) >= waterModes.length) return null
  const config = waterModes[mode as number]!
  const state = waterState(saved.state, config.colors)
  if (!state) return null
  const history = (Array.isArray(saved.history) ? saved.history.slice(-50) : [])
    .map((entry: unknown) => waterState(entry, config.colors))
    .flatMap((entry): WaterState[] => entry ? [entry] : [])
  return { state, history, mode: mode as number }
}
export function restoreSokoban(value: unknown): SokobanDraft | null {
  const saved = object(value), level = saved.level as number
  if (!Number.isInteger(level) || level < 0 || level >= LEVELS.length) return null
  const result = restore(value, value => sokobanState(value, level), () => true)
  return result ? { ...result, level } : null
}
