import { describe, expect, it } from 'vitest'
import {
  FRUIT_LEVELS,
  fruitAt,
  mergeFruits,
  randomDropLevel,
  scoreForLevel
} from '../../src/games/merge-fruit/core/game'

describe('merge fruit rules', () => {
  it('merges two equal fruits into the next level', () => {
    expect(mergeFruits(2, 2)).toEqual({ nextLevel: 3, score: scoreForLevel(3) })
  })

  it('does not merge different fruits and clears two largest fruits', () => {
    expect(mergeFruits(2, 3)).toBeNull()
    expect(mergeFruits(FRUIT_LEVELS.length - 1, FRUIT_LEVELS.length - 1)).toEqual({
      nextLevel: null,
      score: 66
    })
  })

  it('uses the standard triangular merge score without a combo multiplier', () => {
    expect(mergeFruits(0, 0)?.score).toBe(1)
    expect(mergeFruits(4, 4)?.score).toBe(15)
    expect(mergeFruits(9, 9)?.score).toBe(55)
  })

  it('uses the standard eleven-fruit evolution chain', () => {
    expect(FRUIT_LEVELS.map((fruit) => fruit.name)).toEqual([
      '樱桃', '草莓', '葡萄', '凸顶柑', '柿子', '苹果', '梨', '桃子', '菠萝', '蜜瓜', '大西瓜'
    ])
  })

  it('only selects one of the five small drop fruits', () => {
    expect(randomDropLevel(() => 0)).toBe(0)
    expect(randomDropLevel(() => 0.35)).toBe(1)
    expect(randomDropLevel(() => 0.65)).toBe(2)
    expect(randomDropLevel(() => 0.85)).toBe(3)
    expect(randomDropLevel(() => 0.999)).toBe(4)
  })

  it('exposes progressively larger fruit sizes', () => {
    for (let level = 1; level < FRUIT_LEVELS.length; level += 1) {
      expect(fruitAt(level).radius).toBeGreaterThan(fruitAt(level - 1).radius)
      expect(scoreForLevel(level)).toBeGreaterThan(scoreForLevel(level - 1))
    }
  })

  it('rejects an invalid fruit level', () => {
    expect(() => fruitAt(-1)).toThrow('无效的水果等级')
  })
})
