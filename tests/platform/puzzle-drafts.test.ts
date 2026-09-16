import { expect, it } from 'vitest'
import { restoreNonogram, restoreSokoban, restoreSudoku } from '../../src/games/puzzle-kit/core/drafts'
import { newGame as sudoku } from '../../src/games/sudoku/core/game'
import { newGame as nonogram } from '../../src/games/nonogram/core/game'
import { newGame as sokoban } from '../../src/games/sokoban/core/game'
it('restores valid boards and discards corrupt undo entries', () => {
  const state = sudoku(4, () => 0.4)
  expect(restoreSudoku({ state, history: [null, state], assisted: true })).toEqual({ state, history: [state], assisted: true })
  const n = nonogram(5)
  expect(restoreNonogram({ state: n, history: [], assisted: false })?.state).toEqual(n)
  expect(restoreSokoban({ level: 1, state: sokoban(1), history: [] })?.level).toBe(1)
})
it('rejects invalid or incompatible boards without throwing', () => {
  for (const bad of [null, 7, [], {}, { state: {} }]) {
    expect(restoreSudoku(bad)).toBeNull()
    expect(restoreNonogram(bad)).toBeNull()
    expect(restoreSokoban(bad)).toBeNull()
  }
  expect(restoreNonogram({ state: { ...nonogram(), marks: [1] } })).toBeNull()
  expect(restoreNonogram({ state: { ...nonogram(), level: -1 } })).toBeNull()
  expect(restoreSudoku({ state: { ...sudoku(4), solution: Array(16).fill(1) } })).toBeNull()
  expect(restoreSokoban({ level: 0, state: { ...sokoban(), player: 0 } })).toBeNull()
  expect(restoreSokoban({ level: 0, state: { ...sokoban(), boxes: [0] } })).toBeNull()
})
