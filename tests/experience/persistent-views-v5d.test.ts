import { describe, expect, it } from 'vitest'
import { memoryVisualDelta } from '../../src/games/memory/view-model'
import { pipeQuarterTurnDelta } from '../../src/games/pipes/view-model'
import { sokobanVisualDelta } from '../../src/games/sokoban/view-model'

describe('v5-D persistent view deltas', () => {
  it('Memory reveals and conceals only changed cards', () => {
    const base = {
      cards: [0, 1, 0, 1],
      open: [0],
      matched: [],
      turns: 0,
      player: 0,
      scores: [0],
      won: false
    }

    expect(memoryVisualDelta(base, {
      ...base,
      open: [0, 1],
      turns: 1
    })).toEqual({
      reveal: [1],
      conceal: [],
      matched: []
    })

    expect(memoryVisualDelta({
      ...base,
      open: [0, 2]
    }, {
      ...base,
      open: [],
      matched: [0, 2],
      turns: 1
    })).toEqual({
      reveal: [],
      conceal: [],
      matched: [0, 2]
    })

    expect(memoryVisualDelta({
      ...base,
      open: [0, 1]
    }, {
      ...base,
      open: []
    })).toEqual({
      reveal: [],
      conceal: [0, 1],
      matched: []
    })
  })

  it('Pipes chooses the shortest visual quarter-turn', () => {
    expect(pipeQuarterTurnDelta(1, 2)).toBe(1)
    expect(pipeQuarterTurnDelta(2, 1)).toBe(-1)
    expect(pipeQuarterTurnDelta(5, 10)).toBe(1)
    expect(pipeQuarterTurnDelta(5, 5)).toBe(0)
  })

  it('Sokoban identifies exactly the pushed box', () => {
    const previous = {
      width: 5,
      height: 5,
      walls: [],
      goals: [8],
      boxes: [7, 12],
      player: 6,
      moves: 0,
      won: false
    }

    const next = {
      ...previous,
      boxes: [8, 12],
      player: 7,
      moves: 1,
      won: false
    }

    expect(sokobanVisualDelta(previous, next)).toEqual({
      playerFrom: 6,
      playerTo: 7,
      boxIndex: 0,
      boxFrom: 7,
      boxTo: 8
    })
  })

  it('Sokoban reports no box transition for a walking-only move', () => {
    const previous = {
      width: 5,
      height: 5,
      walls: [],
      goals: [],
      boxes: [12],
      player: 6,
      moves: 0,
      won: false
    }

    const next = {
      ...previous,
      player: 7,
      moves: 1
    }

    expect(sokobanVisualDelta(previous, next).boxIndex).toBe(-1)
  })
})
