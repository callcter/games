import { describe, expect, it } from 'vitest'
import {
  BOARD_SIZE,
  chooseComputerMove,
  newGame,
  placeStone,
  toIndex,
  type Board,
  type Cell,
  type GomokuState,
  type Player
} from '../../src/games/gomoku/core/game'

function stateWithStones(stones: Array<[number, number, Player]>, currentPlayer: Player = 1): GomokuState {
  const board = Array<Cell>(BOARD_SIZE * BOARD_SIZE).fill(0)
  stones.forEach(([row, column, player]) => { board[toIndex(row, column)] = player })
  return { ...newGame(), board, currentPlayer, moveCount: stones.length }
}

function boardWithStones(stones: Array<[number, number, Player]>): Board {
  return stateWithStones(stones).board
}

const winningCases: Array<{ points: Array<[number, number]> }> = [
  { points: [[7, 3], [7, 4], [7, 5], [7, 6]] },
  { points: [[3, 7], [4, 7], [5, 7], [6, 7]] },
  { points: [[3, 3], [4, 4], [5, 5], [6, 6]] },
  { points: [[3, 11], [4, 10], [5, 9], [6, 8]] }
]

describe('gomoku rules', () => {
  it('places stones in turns and rejects an occupied point', () => {
    const first = placeStone(newGame(), toIndex(7, 7))
    const occupied = placeStone(first.state, toIndex(7, 7))

    expect(first.placed).toBe(true)
    expect(first.state.board[toIndex(7, 7)]).toBe(1)
    expect(first.state.currentPlayer).toBe(2)
    expect(occupied.placed).toBe(false)
  })

  it.each(winningCases)('detects five connected stones in every direction', ({ points }) => {
    const state = stateWithStones(points.map(([row, column]) => [row, column, 1]), 1)
    const result = placeStone(state, toIndex(7, 7))

    expect(result.state.winner).toBe(1)
    expect(result.state.winningLine).toHaveLength(5)
  })

  it('computer opens in the center', () => {
    expect(chooseComputerMove(newGame().board)).toBe(toIndex(7, 7))
  })

  it('computer takes an immediate winning move', () => {
    const board = boardWithStones([
      [6, 3, 2], [6, 4, 2], [6, 5, 2], [6, 6, 2],
      [7, 7, 1]
    ])

    expect([toIndex(6, 2), toIndex(6, 7)]).toContain(chooseComputerMove(board))
  })

  it('computer blocks an immediate loss', () => {
    const board = boardWithStones([
      [8, 3, 1], [8, 4, 1], [8, 5, 1], [8, 6, 1],
      [7, 7, 2]
    ])

    expect([toIndex(8, 2), toIndex(8, 7)]).toContain(chooseComputerMove(board))
  })
})
