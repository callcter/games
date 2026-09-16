import { expect, it } from 'vitest'
import { conflicts, countSolutions, newGame, place, PUZZLE_BLANKS, SIZES } from '../../src/games/sudoku/core/game'

it('generates unique-solution puzzles deterministically at every difficulty', () => {
  for (const size of SIZES) {
    const random = () => 0.4
    const state = newGame(size, random)
    expect(state).toEqual(newGame(size, random))
    expect(countSolutions(state.puzzle, size)).toBe(1)
    expect(conflicts(state.puzzle, size).size).toBe(0)
    expect(state.puzzle.filter(value => value === 0).length).toBeGreaterThan(Math.floor(PUZZLE_BLANKS[size] / 2))
    state.puzzle.forEach((value, index) => {
      if (value) expect(value).toBe(state.solution[index])
    })
  }
})

it('creates a fresh puzzle from a different random source', () => {
  expect(newGame(9, () => 0.4).puzzle).not.toEqual(newGame(9, () => 0.9).puzzle)
})

it('rejects fixed cells, out-of-range values and no-op placements', () => {
  const state = newGame(4, () => 0.4)
  const fixed = state.puzzle.findIndex(value => value > 0)!
  expect(place(state, fixed, 1)).toBe(state)
  expect(place(state, -1, 1)).toBe(state)
  expect(place(state, 0, 5)).toBe(state)
  expect(place(state, 0, 1.5)).toBe(state)
  const blank = state.puzzle.findIndex(value => value === 0)!
  expect(place(state, blank, state.values[blank] ?? 0)).toBe(state)
})

it('marks a filled conflict-free grid as won and flags conflicting digits', () => {
  const state = newGame(4, () => 0.4)
  const wrong = state.puzzle.findIndex(value => value === 0)!
  const clash = [...state.solution]
  clash[wrong] = clash[wrong] === 4 ? 3 : 4
  const neighbour = clash.findIndex((value, index) => index !== wrong && value === clash[wrong])
  expect(neighbour).toBeGreaterThanOrEqual(0)
  expect(conflicts(clash, 4).size).toBeGreaterThan(0)
  let playing = { ...state, values: [...clash] }
  state.puzzle.forEach((given, index) => { if (!given && index !== wrong) playing = place(playing, index, clash[index] ?? 0) })
  expect(playing.won).toBe(false)
  const solved = state.puzzle.reduce((current, given, index) => given ? current : place(current, index, state.solution[index]!), state)
  expect(solved.won).toBe(true)
})

it('reports row, column and box conflicts separately', () => {
  expect([...conflicts([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4)].sort((a, b) => a - b)).toEqual([0, 1])
  expect([...conflicts([1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4)].sort((a, b) => a - b)).toEqual([0, 3])
  expect([...conflicts([1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4)].sort((a, b) => a - b)).toEqual([0, 4])
})
