import { describe, expect, it } from 'vitest'
import {
  hasAvailableMove,
  moveBoard,
  moveGame,
  newGame,
  restoreGame,
  spawnTile,
  type Board
} from '../../src/games/game-2048/core/game'

const board = (...rows: number[][]): Board => rows.flat()
const sequence = (...values: number[]): (() => number) => {
  let index = 0
  return () => values[index++] ?? 0
}

describe('2048 rules', () => {
  it('starts with exactly two tiles', () => {
    const game = newGame(42, sequence(0, 0, 0.5, 0.95))

    expect(game.board.filter(Boolean)).toEqual([2, 4])
    expect(game.bestScore).toBe(42)
  })

  it('merges each tile at most once in a move', () => {
    const result = moveBoard(board(
      [2, 2, 2, 2],
      [4, 4, 8, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ), 'left')

    expect(result.board.slice(0, 8)).toEqual([4, 4, 0, 0, 8, 8, 0, 0])
    expect(result.scoreGain).toBe(16)
    expect(result.moved).toBe(true)
  })

  it('moves correctly in vertical and reverse directions', () => {
    const input = board(
      [2, 0, 0, 2],
      [2, 0, 0, 2],
      [4, 0, 0, 4],
      [4, 0, 0, 4]
    )

    expect(moveBoard(input, 'up').board).toEqual(board(
      [4, 0, 0, 4],
      [8, 0, 0, 8],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ))
    expect(moveBoard(input, 'down').board).toEqual(board(
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [4, 0, 0, 4],
      [8, 0, 0, 8]
    ))
  })

  it('does not spawn a tile after an ineffective move', () => {
    const initial = {
      board: board(
        [2, 4, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ),
      score: 0,
      bestScore: 0,
      gameOver: false,
      won: false
    }

    const result = moveGame(initial, 'left', () => {
      throw new Error('random must not be called')
    })

    expect(result.moved).toBe(false)
    expect(result.state).toBe(initial)
  })

  it('spawns a four in the selected free cell', () => {
    const input = board(
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2, 4],
      [8, 16, 0, 0]
    )

    expect(spawnTile(input, sequence(0.99, 0.95))).toEqual(board(
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2, 4],
      [8, 16, 0, 4]
    ))
  })

  it('recognizes finished and playable boards', () => {
    expect(hasAvailableMove(board(
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2]
    ))).toBe(false)
    expect(hasAvailableMove(board(
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 4, 2],
      [4, 2, 2, 4]
    ))).toBe(true)
  })

  it('rejects malformed saved data', () => {
    expect(restoreGame({ board: [2], score: 0, bestScore: 0, gameOver: false, won: false })).toBeNull()
    expect(restoreGame({
      board: [...Array<number>(15).fill(0), 3],
      score: 0,
      bestScore: 0,
      gameOver: false,
      won: false
    })).toBeNull()
  })
})
