import { type RandomSource } from '../../cards/core/cards'

// Water Sort rule layer. No Phaser / DOM dependencies.
export const TUBE_CAPACITY = 4

export interface WaterState {
  /** Each tube is stored bottom -> top. Empty tube = []. */
  tubes: number[][]
  colors: number
  moves: number
  won: boolean
}

export interface WaterMove {
  from: number
  to: number
}

export interface WaterMode {
  label: string
  colors: number
  empties: number
  /** Generated solution-path range; used as a practical difficulty band. */
  minSolution: number
  maxSolution: number
}

export const MODES: readonly WaterMode[] = [
  { label: '基础', colors: 3, empties: 2, minSolution: 7, maxSolution: 14 },
  { label: '进阶', colors: 5, empties: 2, minSolution: 15, maxSolution: 28 },
  { label: '挑战', colors: 6, empties: 2, minSolution: 19, maxSolution: 36 }
]

/** Number of same-colored layers contiguous at the tube top. */
export function topRun(tube: readonly number[]): number {
  if (!tube.length) return 0
  const top = tube[tube.length - 1]!
  let run = 1
  while (run < tube.length && tube[tube.length - 1 - run] === top) run++
  return run
}

export function isTubeComplete(tube: readonly number[]): boolean {
  return tube.length === TUBE_CAPACITY && topRun(tube) === TUBE_CAPACITY
}

export function completedCount(state: WaterState): number {
  return state.tubes.filter(isTubeComplete).length
}

function isWon(tubes: readonly (readonly number[])[]): boolean {
  return tubes.every(tube => !tube.length || isTubeComplete(tube))
}

export function canPour(state: WaterState, from: number, to: number): boolean {
  if (from === to || state.won) return false
  const source = state.tubes[from]
  const target = state.tubes[to]
  if (!source?.length || target === undefined || target.length >= TUBE_CAPACITY) return false
  return target.length === 0 || target[target.length - 1] === source[source.length - 1]
}

/**
 * Pour the full legal top run, truncated by destination capacity.
 * State is immutable; illegal moves return null.
 */
export function pour(
  state: WaterState,
  from: number,
  to: number
): { state: WaterState; poured: number } | null {
  if (!canPour(state, from, to)) return null
  const source = state.tubes[from]!
  const target = state.tubes[to]!
  const poured = Math.min(topRun(source), TUBE_CAPACITY - target.length)
  const tubes = state.tubes.map((tube, index) => {
    if (index === from) return tube.slice(0, tube.length - poured)
    if (index === to) return [...tube, ...source.slice(-poured)]
    return [...tube]
  })
  return {
    state: {
      ...state,
      tubes,
      moves: state.moves + 1,
      won: isWon(tubes)
    },
    poured
  }
}

function canonicalKey(tubes: readonly (readonly number[])[]): string {
  // Tube positions are interchangeable for reachability, so sorted signatures
  // safely collapse symmetric states and dramatically reduce search.
  return tubes.map(tube => tube.join(',')).sort().join('|')
}

interface SearchMove extends WaterMove {
  moved: number
  score: number
}

function searchMoves(tubes: readonly (readonly number[])[]): SearchMove[] {
  const options: SearchMove[] = []

  for (let from = 0; from < tubes.length; from++) {
    const source = tubes[from]!
    let usedEmptyDestination = false
    if (!source.length || isTubeComplete(source)) continue

    const run = topRun(source)
    const sourceIsUniform = run === source.length

    for (let to = 0; to < tubes.length; to++) {
      if (from === to) continue
      const target = tubes[to]!
      if (target.length >= TUBE_CAPACITY) continue
      if (target.length && target[target.length - 1] !== source[source.length - 1]) continue

      if (!target.length) {
        // Empty destinations are symmetric. Moving a completely uniform source
        // to an empty tube merely relocates it and never unlocks a new color.
        if (usedEmptyDestination || sourceIsUniform) continue
        usedEmptyDestination = true
      }

      const moved = Math.min(run, TUBE_CAPACITY - target.length)
      const merge = target.length > 0
      const completesTarget = target.length + moved === TUBE_CAPACITY
      const emptiesSource = moved === source.length

      options.push({
        from,
        to,
        moved,
        // Strongly prefer productive merges, then completing/emptying tubes.
        score:
          (merge ? 40 : 0)
          + (completesTarget ? 18 : 0)
          + (emptiesSource ? 10 : 0)
          + moved * 2
          + target.length
      })
    }
  }

  options.sort((a, b) => b.score - a.score)
  return options
}

function applySearchMove(
  tubes: readonly (readonly number[])[],
  move: SearchMove
): number[][] {
  const source = tubes[move.from]!
  const payload = source.slice(source.length - move.moved)
  return tubes.map((tube, index) => {
    if (index === move.from) return source.slice(0, source.length - move.moved)
    if (index === move.to) return [...tube, ...payload]
    return [...tube]
  })
}

/**
 * Find one real solution path. This powers both generation validation and
 * the in-game hint, so a generated level can never claim "solvable" based on
 * a different approximation.
 */
export function solvePath(state: WaterState, nodeLimit = 250_000): WaterMove[] | null {
  if (state.won || isWon(state.tubes)) return []

  const seen = new Set<string>()
  const path: WaterMove[] = []
  let remaining = nodeLimit

  const search = (tubes: number[][]): boolean => {
    if (isWon(tubes)) return true
    if (remaining-- <= 0) return false

    const key = canonicalKey(tubes)
    if (seen.has(key)) return false
    seen.add(key)

    for (const move of searchMoves(tubes)) {
      const next = applySearchMove(tubes, move)
      path.push({ from: move.from, to: move.to })
      if (search(next)) return true
      path.pop()
    }
    return false
  }

  return search(state.tubes.map(tube => [...tube])) ? [...path] : null
}

/** Compatibility API retained for existing tests/callers. */
export function solvable(state: WaterState, nodeLimit = 250_000): boolean {
  return solvePath(state, nodeLimit) !== null
}

/**
 * Legacy compatibility name. The new implementation uses the same exact path
 * finder as hints/generation instead of probabilistic greedy retries.
 */
export function greedySolves(
  state: WaterState,
  _random: RandomSource = Math.random,
  _tries = 60
): boolean {
  return solvePath(state, 250_000) !== null
}

/**
 * BFS minimum move count. Keep for small-state tests only; generation uses
 * solvePath so normal startup never pays this cost.
 */
export function optimalSteps(state: WaterState, nodeLimit = 80_000): number {
  if (state.won || isWon(state.tubes)) return 0

  const key = canonicalKey
  const seen = new Set([key(state.tubes)])
  let frontier: number[][][] = [state.tubes.map(tube => [...tube])]

  for (let depth = 0; frontier.length && depth < 200; depth++) {
    const next: number[][][] = []
    for (const tubes of frontier) {
      for (const move of searchMoves(tubes)) {
        const board = applySearchMove(tubes, move)
        if (isWon(board)) return depth + 1
        const signature = key(board)
        if (seen.has(signature)) continue
        if (seen.size >= nodeLimit) return -1
        seen.add(signature)
        next.push(board)
      }
    }
    frontier = next
  }
  return -1
}

/** Fast practical solution length used by older call sites. */
export function greedyStepCount(
  state: WaterState,
  _random: RandomSource = Math.random
): number {
  return solvePath(state, 250_000)?.length ?? -1
}

function shuffled<T>(list: T[], random: RandomSource): T[] {
  for (let index = list.length - 1; index > 0; index--) {
    const candidate = Math.floor(random() * (index + 1))
    const swap = Number.isFinite(candidate) ? Math.max(0, Math.min(index, candidate)) : 0
    ;[list[index], list[swap]] = [list[swap]!, list[index]!]
  }
  return list
}

function validInventory(state: WaterState): boolean {
  const layers = state.tubes.flat()
  if (layers.length !== state.colors * TUBE_CAPACITY) return false
  for (let color = 0; color < state.colors; color++) {
    if (layers.filter(layer => layer === color).length !== TUBE_CAPACITY) return false
  }
  return true
}

/**
 * Fixed legal fallbacks. They are intentionally mixed, preserve every liquid
 * layer, contain two empty tubes, and have verified solution paths.
 *
 * Previous fallbackDeal could set a full tube to [] and append only part of
 * its liquid elsewhere, silently deleting layers. Static validated fallbacks
 * make that class of corruption impossible.
 */
const FALLBACKS: readonly (readonly (readonly number[])[])[] = [
  [
    [2, 0, 2, 2],
    [1, 1, 1, 2],
    [1, 0, 0, 0],
    [],
    []
  ],
  [
    [1, 3, 2, 2],
    [4, 4, 0, 1],
    [3, 0, 1, 1],
    [3, 0, 2, 0],
    [2, 3, 4, 4],
    [],
    []
  ],
  [
    [2, 2, 0, 0],
    [5, 0, 2, 0],
    [3, 1, 4, 5],
    [3, 4, 3, 5],
    [4, 4, 1, 1],
    [1, 5, 3, 2],
    [],
    []
  ]
]

function fallbackState(mode: number): WaterState {
  const config = MODES[mode] ?? MODES[0]!
  const source = FALLBACKS[mode] ?? FALLBACKS[0]!
  const state: WaterState = {
    tubes: source.map(tube => [...tube]),
    colors: config.colors,
    moves: 0,
    won: false
  }
  if (!validInventory(state) || solvePath(state) === null) {
    throw new Error(`Invalid built-in water-sort fallback for mode ${mode}`)
  }
  return state
}

/**
 * Generate a visibly mixed, verified-solvable board.
 *
 * - Two empty tubes are deliberate: they make touch play forgiving for a child
 *   while difficulty comes from more colors and longer solution paths.
 * - Random deals are accepted only when the exact solver returns a path in the
 *   mode's difficulty band.
 * - No "best effort" corrupted fallback exists.
 */
export function newGame(mode: number, random: RandomSource = Math.random): WaterState {
  const resolvedMode = MODES[mode] ? mode : 0
  const config = MODES[resolvedMode]!
  const base = Array.from(
    { length: config.colors * TUBE_CAPACITY },
    (_, index) => Math.floor(index / TUBE_CAPACITY)
  )

  for (let attempt = 0; attempt < 140; attempt++) {
    // Rotate before shuffling so deterministic/constant random sources still
    // produce different candidates across attempts.
    const rotate = (attempt * 7) % base.length
    const rotated = [...base.slice(rotate), ...base.slice(0, rotate)]
    const layers = shuffled(rotated, random)
    const tubes: number[][] = Array.from(
      { length: config.colors },
      (_, tube) => layers.slice(tube * TUBE_CAPACITY, (tube + 1) * TUBE_CAPACITY)
    )
    for (let empty = 0; empty < config.empties; empty++) tubes.push([])

    if (tubes.some(isTubeComplete)) continue
    const state: WaterState = { tubes, colors: config.colors, moves: 0, won: false }
    if (!validInventory(state)) continue

    const path = solvePath(state, 250_000)
    if (!path) continue
    if (path.length < config.minSolution || path.length > config.maxSolution) continue
    return state
  }

  return fallbackState(resolvedMode)
}
