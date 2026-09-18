import { describe, expect, it } from 'vitest'
import { isStuck, MODES, newMatch, pick, pickable, shuffle, simSolves, SLOT_SIZE, undo, type MatchState, type Tile } from '../../src/games/tile-match/core/game'

// 构造无遮挡三层的可控局面：kind 0 三张在顶层，kind 1 两张在底层被压。
const tile = (id: number, kind: number, layer: number, gx: number, gy: number): Tile => ({ id, kind, layer, gx, gy })
const flat = (tiles: Tile[]): MatchState => ({ tiles, gone: [], slot: [], cleared: 0, undoLog: [], undos: 5, shuffles: 1, won: false })

describe('叠叠消规则', () => {
  it('满槽必须停手，洗牌收回槽中牌后可继续，失败不得扣次数', () => {
    const state = flat(Array.from({ length: 12 }, (_, id) => tile(id, Math.floor(id / 3), 0, id, 0)))
    let current = state
    for (const id of [0, 1, 3, 4, 6, 7, 9]) current = pick(current, id)!.state
    expect(simSolves(current)).toBe(false)
    const next = shuffle(current, () => 0.3)!
    expect(next).not.toBeNull()
    expect(next.slot).toEqual([])
    expect(isStuck(next)).toBe(false)
    expect(pickable(next).some(id => pick(next, id) !== null)).toBe(true)
    expect(simSolves(next)).toBe(true)
    expect(current.slot).toHaveLength(7)
  })
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

describe('叠叠消生成器（v3 构造式）', () => {
  const mulberry32 = (seed: number) => (): number => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  it('三档各 100 局：张数/层数/每层布局正确且随机源不再影响结构', () => {
    for (const [mode, config] of MODES.entries()) {
      for (let seed = 1; seed <= 100; seed++) {
        const state = newMatch(mode, mulberry32(seed))
        expect(state.tiles).toHaveLength(config.tiles)
        expect(new Set(state.tiles.map(tile => tile.layer)).size).toBe(config.layers)
        for (let kind = 0; kind < config.kinds; kind++) {
          expect(state.tiles.filter(tile => tile.kind === kind).length % 3).toBe(0)
        }
        expect(pickable(state).length).toBeGreaterThanOrEqual(3)
        expect(state.undos).toBe(5)
        expect(state.shuffles).toBe(1)
      }
    }
  }, 60000)

  it('极端随机源 ()=>0 也不退化为单层平铺（旧 fallback 已移除）', () => {
    for (const mode of [0, 1, 2]) {
      const state = newMatch(mode, () => 0)
      expect(Math.max(...state.tiles.map(tile => tile.layer))).toBe(MODES[mode]!.layers - 1)
      expect(new Set(state.tiles.map(tile => tile.layer)).size).toBe(MODES[mode]!.layers)
    }
  })

  it('任意生成局存在完整移除拓扑序（构造保证，与玩法策略无关）', () => {
    // 与具体拾取策略无关的结构保证：只要一直移除「当前未被压住」的牌
    // （这正是构造序的定义），总能移完所有牌。
    for (const mode of [0, 1, 2]) {
      const state = newMatch(mode, mulberry32(42))
      const gone = new Set<number>()
      let guard = 0
      while (gone.size < state.tiles.length && guard++ < state.tiles.length + 5) {
        const free = state.tiles.filter(tile => !gone.has(tile.id)
          && !state.tiles.some(other => other.id !== tile.id && !gone.has(other.id)
            && other.layer > tile.layer && Math.abs(other.gx - tile.gx) < 0.92 && Math.abs(other.gy - tile.gy) < 0.92))
        if (!free.length) break
        gone.add(free[0]!.id)
      }
      expect(gone.size).toBe(state.tiles.length)
    }
  })

  it('洗牌对三种难度的新局都返回有效救援局', () => {
    for (const mode of [0, 1, 2]) {
      for (let seed = 1; seed <= 20; seed++) {
        const state = newMatch(mode, mulberry32(seed))
        const shuffled = shuffle(state, mulberry32(seed + 1000))
        expect(shuffled).not.toBeNull()
        expect(shuffled?.slot).toEqual([])
        expect(shuffled?.tiles).toHaveLength(state.tiles.length)
      }
    }
  })
})
