import { describe, expect, it } from 'vitest'
import type { Card, RandomSource } from '../../src/games/cards/core/cards'
import { canDropOnColumn, draw, newDeal, nextAutoMove, playColumn, playWaste, recall, stuck } from '../../src/games/klondike/core/game'

const card = (suit: Card['suit'], rank: number): Card => ({ id: `${suit}${rank}`, suit, rank, color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black' })
const fixed: RandomSource = () => 0.42

describe('纸牌规则', () => {
  it('发牌结构：7 列阶梯、每列仅顶牌明、其余 24 张进翻牌堆', () => {
    const state = newDeal(fixed)
    expect(state.columns).toHaveLength(7)
    state.columns.forEach((column, index) => {
      expect(column.hidden).toHaveLength(index)
      expect(column.up).toHaveLength(1)
    })
    expect(state.stock).toHaveLength(24)
    expect(state.won).toBe(false)
    const all = [...state.stock, ...state.columns.flatMap(column => [...column.hidden, ...column.up])]
    expect(all).toHaveLength(52)
    expect(new Set(all.map(entry => entry.id)).size).toBe(52)
  })
  it('列接收规则：红黑交替递减，空列只收 K', () => {
    expect(canDropOnColumn(card('hearts', 5), { hidden: [], up: [card('spades', 6)] })).toBe(true)
    expect(canDropOnColumn(card('hearts', 5), { hidden: [], up: [card('diamonds', 6)] })).toBe(false)
    expect(canDropOnColumn(card('hearts', 5), { hidden: [], up: [card('spades', 5)] })).toBe(false)
    expect(canDropOnColumn(card('hearts', 5), { hidden: [], up: [card('spades', 7)] })).toBe(false)
    expect(canDropOnColumn(card('clubs', 13), { hidden: [], up: [] })).toBe(true)
    expect(canDropOnColumn(card('clubs', 12), { hidden: [], up: [] })).toBe(false)
  })
  it('翻牌：逐张翻出、翻完把废牌堆整叠翻回，可无限循环', () => {
    const state = newDeal(fixed)
    let current = state
    for (let index = 0; index < 24; index++) current = draw(current)
    expect(current.stock).toHaveLength(0)
    expect(current.waste).toHaveLength(24)
    const reset = draw(current)
    expect(reset.stock).toHaveLength(24)
    expect(reset.waste).toHaveLength(0)
    // 翻回后再翻出的第一张，应是最早翻出的那张（先翻先回底）
    expect(draw(reset).waste.at(-1)!.id).toBe(current.waste[0]!.id)
  })
  it('废牌堆顶可送基础堆或列，非法目标拒绝且不改状态', () => {
    const base = newDeal(fixed)
    const drawn = draw(base)
    const top = drawn.waste[drawn.waste.length - 1]!
    const toFoundation = playWaste(drawn, 'foundation')
    expect(toFoundation.moved).toBe(top.rank === 1)
    const moved = playWaste(drawn, 6)
    const target = drawn.columns[6]!
    const targetTop = target.up[target.up.length - 1]!
    expect(moved.moved).toBe(targetTop.rank === top.rank + 1 && targetTop.color !== top.color)
    if (moved.moved) {
      expect(moved.state.waste).toHaveLength(drawn.waste.length - 1)
      expect(drawn.waste).toHaveLength(base.stock.length - 0 - 24 + 25 - 24) // 原状态不被修改
    }
    expect(playWaste(drawn, 99).moved).toBe(false)
    expect(drawn.waste).toHaveLength(1)
  })
  it('列段移动：连续合法段可整段搬走并翻开新顶牌', () => {
    const state = {
      ...newDeal(fixed),
      columns: [
        { hidden: [card('diamonds', 9)], up: [card('clubs', 7), card('hearts', 6), card('spades', 5)] },
        { hidden: [], up: [card('hearts', 8)] }, { hidden: [], up: [card('spades', 7)] }, { hidden: [], up: [] },
        { hidden: [], up: [] }, { hidden: [], up: [] }, { hidden: [], up: [] }
      ]
    }
    // 整段 3 张（♣7,♥6,♠5）段头 ♣7 可放到红 8 上
    const whole = playColumn(state, 0, 3, 1)
    expect(whole.moved).toBe(true)
    expect(whole.state.columns[1]!.up.map(entry => entry.rank)).toEqual([8, 7, 6, 5])
    // 2 张（♥6,♠5）可放到黑 7 上；源列还剩明牌 ♣7，其下暗牌保持盖着
    const part = playColumn(state, 0, 2, 2)
    expect(part.moved).toBe(true)
    expect(part.state.columns[2]!.up.map(entry => entry.rank)).toEqual([7, 6, 5])
    expect(part.state.columns[0]!.up.map(entry => entry.rank)).toEqual([7])
    expect(part.state.columns[0]!.hidden).toHaveLength(1)
    // 整段搬空后源列顶的暗牌 ♦9 才翻开
    expect(whole.state.columns[0]!.up.map(entry => entry.rank)).toEqual([9])
    expect(whole.state.columns[0]!.hidden).toHaveLength(0)
    // 中途拿 2 张到空列不行（空列只收 K 开头的段）
    expect(playColumn(part.state, 2, 2, 3).moved).toBe(false)
  })
  it('列顶可上基础堆并推进胜利判定；基础堆可取回', () => {
    const state = {
      ...newDeal(fixed),
      foundations: { spades: 0, hearts: 0, clubs: 0, diamonds: 0 },
      columns: [
        { hidden: [], up: [card('spades', 1)] }, { hidden: [], up: [] }, { hidden: [], up: [] },
        { hidden: [], up: [] }, { hidden: [], up: [] }, { hidden: [], up: [] }, { hidden: [], up: [] }
      ]
    }
    const played = playColumn(state, 0, 1, 'foundation')
    expect(played.moved).toBe(true)
    expect(played.state.foundations.spades).toBe(1)
    // 取回到有 ♥2 的列（A 可以垫在黑 2 上），空列只收 K
    const target = { ...played.state, columns: played.state.columns.map((column, index) => index === 1 ? { hidden: [], up: [card('hearts', 2)] } : column) }
    const recalled = recall(target, 'spades', 1)
    expect(recalled.moved).toBe(true)
    expect(recalled.state.foundations.spades).toBe(0)
    expect(recalled.state.columns[1]!.up.map(entry => entry.rank)).toEqual([2, 1])
    expect(recall(target, 'spades', 2).moved).toBe(false)
  })
  it('残局安全自动收尾只动安全的牌且不抽走有暗牌的列', () => {
    const state = {
      ...newDeal(fixed),
      foundations: { spades: 1, hearts: 1, clubs: 1, diamonds: 1 },
      columns: [
        { hidden: [card('diamonds', 9)], up: [card('spades', 2)] }, // 有暗牌：不自动收
        { hidden: [], up: [card('hearts', 2)] }, // 2 恒安全
        { hidden: [], up: [] }, { hidden: [], up: [] }, { hidden: [], up: [] }, { hidden: [], up: [] }, { hidden: [], up: [] }
      ]
    }
    const move = nextAutoMove(state)
    expect(move).toEqual({ kind: 'column', from: 1 })
    const blocked = { ...state, columns: state.columns.map((column, index) => index === 1 ? { hidden: [card('clubs', 8)], up: column.up } : column) }
    expect(nextAutoMove(blocked)).toBeNull()
  })
  it('还能翻牌就不算卡死', () => {
    const state = newDeal(fixed)
    expect(stuck(state)).toBe(false)
  })
})
