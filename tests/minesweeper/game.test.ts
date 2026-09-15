import { describe, expect, it } from 'vitest'
import {
  chordCell,
  newGame,
  remainingMines,
  revealCell,
  toggleFlag,
  type MineCell,
  type MinesweeperState
} from '../../src/games/minesweeper/core/game'

describe('minesweeper rules', () => {
  it('keeps the first cell and all neighbors safe', () => {
    const result = revealCell(newGame(), 40, () => 0)
    const safe = [30, 31, 39, 40, 41, 48, 49, 50]
    expect(safe.every((index) => result.state.cells[index]?.mine === false)).toBe(true)
    expect(result.state.cells.filter((cell) => cell.mine)).toHaveLength(10)
  })

  it('calculates adjacent mine counts', () => {
    const state = revealCell(newGame(), 0, () => 0).state
    state.cells.forEach((cell, index) => {
      if (cell.mine) return
      const row = Math.floor(index / state.width)
      const column = index % state.width
      const actual = state.cells.filter((neighbor, neighborIndex) => {
        const neighborRow = Math.floor(neighborIndex / state.width)
        const neighborColumn = neighborIndex % state.width
        return neighbor.mine && Math.abs(row - neighborRow) <= 1 && Math.abs(column - neighborColumn) <= 1
      }).length
      expect(cell.adjacent).toBe(actual)
    })
  })

  it('toggles flags and updates the remaining mine counter', () => {
    const game = newGame()
    const flagged = toggleFlag(game, 3).state
    expect(flagged.cells[3]?.visibility).toBe('flagged')
    expect(remainingMines(flagged)).toBe(9)
    expect(toggleFlag(flagged, 3).state.cells[3]?.visibility).toBe('hidden')
  })

  it('reveals a connected empty area', () => {
    const result = revealCell(newGame(), 0, () => 0)
    expect(result.state.cells.filter((cell) => cell.visibility === 'revealed').length).toBeGreaterThan(1)
  })

  it('loses when a mine is revealed', () => {
    const prepared = revealCell(newGame(), 0, () => 0).state
    const mine = prepared.cells.findIndex((cell) => cell.mine)
    const result = revealCell(prepared, mine)
    expect(result.state.status).toBe('lost')
    expect(result.state.explodedIndex).toBe(mine)
  })

  it('wins after every safe cell is revealed', () => {
    let state = revealCell(newGame(), 0, () => 0).state
    state.cells.forEach((cell, index) => {
      if (!cell.mine && cell.visibility === 'hidden') state = revealCell(state, index).state
    })
    expect(state.status).toBe('won')
    expect(state.remainingSafe).toBe(0)
  })

  it('chords around a number when adjacent flags match', () => {
    const cells: MineCell[] = Array.from({ length: 16 }, () => ({ mine: false, adjacent: 0, visibility: 'hidden' }))
    cells[0] = { mine: false, adjacent: 1, visibility: 'revealed' }
    cells[1] = { mine: true, adjacent: 0, visibility: 'flagged' }
    const state: MinesweeperState = {
      width: 4, height: 4, mineCount: 1, cells, status: 'playing', remainingSafe: 14, explodedIndex: null
    }
    const result = chordCell(state, 0)
    expect(result.changed).toBe(true)
    expect(result.state.cells[4]?.visibility).toBe('revealed')
    expect(result.state.cells[5]?.visibility).toBe('revealed')
  })
})

