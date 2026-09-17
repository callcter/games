import { describe, expect, it } from 'vitest'
import { isStuck, MODES, newMatch, pick, pickable, shuffle, simSolves, SLOT_SIZE, undo, type MatchState, type Tile } from '../../src/games/tile-match/core/game'

// 构造无遮挡三层的可控局面：kind 0 三张在顶层，kind 1 两张在底层被压。
const tile = (id: number, kind: number, layer: number, gx: number, gy: number): Tile => ({ id, kind, layer, gx, gy })
const flat = (tiles: Tile[]): MatchState => ({ tiles, gone: [], slot: [], cleared: 0, undoLog: [], undos: 5, shuffles: 1, won: false })

describe('叠叠消规则', () => {
  it('被上层压住的方块不可拾取，顶层可拾取', () => {
    const state = flat([tile(0, 0, 0, 0, 0), tile(1, 0, 0, 1, 0), tile(2, 0, 0, 2, 0), tile(3, 1, 1, 0.5, 0)])
    // 上层 (0.5,0) 与底层 (0,0)、(1,0) 都重叠 → 只有底层 2 和顶层 3 可拾。
    expect(pickable(state)).toEqual([2, 3])
    expect(pick(state, 0)).toBeNull()
  })
  it('同款凑满三个立即消除并推进胜利判定', () => {
    const state = flat([tile(0, 2, 0, 0, 0), tile(1, 2, 0, 1, 0), tile(2, 2, 0, 2, 0)])
    const first = pick(state, 0)!
    expect(first.state.slot).toEqual([0])
    const second = pick(first.state, 1)!
    expect(second.state.slot).toEqual([0, 1])
    const third = pick(second.state, 2)!
    expect(third.cleared).toEqual([0, 1, 2])
    expect(third.state.slot).toEqual([])
    expect(third.state.cleared).toBe(1)
    expect(third.state.won).toBe(true)
    expect(pick(third.state, 0)).toBeNull() // 胜利后不再接受输入
  })
  it('槽满后不能再拾取并判定卡死', () => {
    const tiles = Array.from({ length: 8 }, (_, index) => tile(index, index, 0, index, 0))
    const state = flat(tiles)
    let current = state
    for (let index = 0; index < SLOT_SIZE; index++) current = pick(current, index)!.state
    expect(isStuck(current)).toBe(true)
    expect(pick(current, 7)).toBeNull()
  })
  it('撤销可回退普通拾取与消除后的拾取', () => {
    const state = flat([tile(0, 2, 0, 0, 0), tile(1, 2, 0, 1, 0), tile(2, 2, 0, 2, 0), tile(3, 5, 0, 3, 0)])
    const picked = pick(pick(pick(state, 0)!.state, 1)!.state, 2)!
    // 消除后撤销：三张回场、消除计数回退、撤销次数消耗。
    const restored = undo(picked.state)!
    expect(restored.gone).toEqual([])
    expect(restored.slot).toEqual([])
    expect(restored.cleared).toBe(0)
    expect(restored.undos).toBe(4)
    expect(restored.won).toBe(false)
    // 普通拾取后撤销
    const once = pick(state, 0)!
    expect(undo(once.state)!.gone).toEqual([])
  })
  it('洗牌保持可解并消耗次数', () => {
    const state = flat([tile(0, 0, 0, 0, 0), tile(1, 0, 0, 1, 0), tile(2, 0, 0, 2, 0), tile(3, 1, 0, 3, 0), tile(4, 1, 0, 4, 0), tile(5, 1, 0, 5, 0)])
    const shuffled = shuffle(state, () => 0.3)!
    expect(shuffled).not.toBeNull()
    expect(shuffled.shuffles).toBe(0)
    expect(shuffled.tiles.map(tile => tile.kind).sort()).toEqual(state.tiles.map(tile => tile.kind).sort())
    expect(simSolves(shuffled)).toBe(true)
    expect(shuffle(shuffled, () => 0.3)).toBeNull() // 次数用完
  })
})

describe('叠叠消生成器', () => {
  it('固定随机下三档生成可解、三倍数、组数正确的局面', () => {
    for (const [mode, config] of MODES.entries()) {
      let seed = 7 + mode * 613
      const random = (): number => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      for (let round = 0; round < 3; round++) {
        const state = newMatch(mode, random)
        const total = state.tiles.length - (state.tiles.length % 3)
        expect(state.tiles.length % 3).toBe(0)
        expect(total).toBeGreaterThan(0)
        for (let kind = 0; kind < config.kinds; kind++) {
          expect(state.tiles.filter(tile => tile.kind === kind).length % 3).toBe(0) // 每种都是三的倍数
        }
        expect(state.undos).toBe(5)
        expect(state.shuffles).toBe(1)
        expect(simSolves(state)).toBe(true)
      }
    }
  })
})
