import { describe, expect, it } from 'vitest'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  PIECE_TYPES,
  ghostRow,
  hardDrop,
  moveHorizontal,
  newGame,
  pieceCells,
  rotatePiece,
  softDrop,
  type Cell,
  type TetrisState
} from '../../src/games/tetris/core/game'

const constantRandom = (value: number): (() => number) => () => value

describe('tetris rules', () => {
  it('uses every tetromino once in the first bag', () => {
    const state = newGame(constantRandom(0.5))
    const firstSeven = [state.active.type, state.nextType, ...state.bag]

    expect(firstSeven).toHaveLength(7)
    expect(new Set(firstSeven)).toEqual(new Set(PIECE_TYPES))
  })

  it('stops a piece at the left wall', () => {
    let state = newGame(constantRandom(0))
    for (let move = 0; move < 8; move += 1) state = moveHorizontal(state, -1).state

    expect(Math.min(...pieceCells(state.active).map((cell) => cell.column))).toBe(0)
    expect(moveHorizontal(state, -1).changed).toBe(false)
  })

  it('soft drop moves down and awards one point', () => {
    const state = newGame(constantRandom(0))
    const result = softDrop(state)

    expect(result.state.active.row).toBe(state.active.row + 1)
    expect(result.state.score).toBe(1)
  })

  it('hard drop locks a piece and spawns the next one', () => {
    const state = newGame(constantRandom(0))
    const result = hardDrop(state, constantRandom(0))

    expect(result.locked).toBe(true)
    expect(result.state.active.type).toBe(state.nextType)
    expect(result.state.board.filter(Boolean)).toHaveLength(4)
    expect(result.state.score).toBeGreaterThan(0)
  })

  it('clears a completed line and scores it', () => {
    const board = Array<Cell>(BOARD_WIDTH * BOARD_HEIGHT).fill(null)
    for (let column = 0; column < BOARD_WIDTH; column += 1) {
      if (column < 3 || column > 6) board[(BOARD_HEIGHT - 1) * BOARD_WIDTH + column] = 'J'
    }
    const base = newGame(constantRandom(0))
    const state: TetrisState = {
      ...base,
      board,
      active: { type: 'I', rotation: 0, row: BOARD_HEIGHT - 2, column: 3 }
    }

    const result = hardDrop(state, constantRandom(0))

    expect(result.clearedLines).toBe(1)
    expect(result.state.lines).toBe(1)
    expect(result.state.score).toBe(100)
  })

  it('rotates and keeps the piece inside the board with a wall kick', () => {
    const base = newGame(constantRandom(0))
    const state: TetrisState = {
      ...base,
      active: { type: 'I', rotation: 1, row: 2, column: -1 }
    }
    const result = rotatePiece(state)

    expect(result.changed).toBe(true)
    expect(pieceCells(result.state.active).every((cell) => cell.column >= 0)).toBe(true)
  })

  it('calculates the landing row without changing state', () => {
    const state = newGame(constantRandom(0))
    const row = ghostRow(state)

    expect(row).toBeGreaterThan(state.active.row)
    expect(state.active.row).toBe(0)
  })
})

