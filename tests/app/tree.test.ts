import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { awardLeaf, readTree, treeStage, TREE_STAGES } from '../../src/app/tree'

describe('treeStage', () => {
  it('叶子数落进正确阶段', () => {
    expect(treeStage(0).name).toBe('种子')
    expect(treeStage(2).name).toBe('种子')
    expect(treeStage(3).name).toBe('小芽')
    expect(treeStage(8).name).toBe('小树')
    expect(treeStage(30).name).toBe('开花')
    expect(treeStage(100).name).toBe('树屋')
  })

  it('阶段阈值单调递增', () => {
    for (let i = 1; i < TREE_STAGES.length; i++) {
      expect(TREE_STAGES[i]!.at).toBeGreaterThan(TREE_STAGES[i - 1]!.at)
    }
  })
})

describe('readTree / awardLeaf（localStorage 环境）', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = String(value) },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { for (const key of Object.keys(store)) delete store[key] },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() { return Object.keys(store).length }
    } as Storage)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('无存档时是零叶种子', () => {
    const tree = readTree()
    expect(tree.leaves).toBe(0)
    expect(tree.milestones).toEqual({})
  })

  it('首次达成发一片叶子，重复达成不再发', () => {
    expect(awardLeaf('parking-clear')).toBe(true)
    expect(awardLeaf('parking-clear')).toBe(false)
    expect(awardLeaf('parking-clear')).toBe(false)
    expect(readTree().leaves).toBe(1)
    expect(awardLeaf('sudoku-6')).toBe(true)
    expect(readTree().leaves).toBe(2)
  })

  it('损坏数据不阻止开局（回到零叶）', () => {
    localStorage.setItem('family-game-room-tree-v1', '{oops')
    expect(readTree().leaves).toBe(0)
    expect(awardLeaf('x')).toBe(true)
    expect(readTree().leaves).toBe(1)
  })

  it('叶子只增不减（读取端不允许负数）', () => {
    localStorage.setItem('family-game-room-tree-v1', JSON.stringify({ version: 1, leaves: -5, milestones: {} }))
    expect(readTree().leaves).toBe(0)
  })
})
