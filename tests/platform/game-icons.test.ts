import { describe, expect, it } from 'vitest'
import { gameIcon, GAME_ICON_IDS } from '../../src/app/icons'
import { puzzles } from '../../src/app/puzzles'

describe('本地游戏图标', () => {
  it('覆盖所有 20 款游戏且图形互不相同', () => {
    const ids = ['2048','gomoku','tetris','merge-fruit','freecell','spider','minesweeper', ...puzzles.map(game => game.id)]
    expect(GAME_ICON_IDS.toSorted()).toEqual(ids.toSorted())
    expect(new Set(ids.map(gameIcon)).size).toBe(ids.length)
  })
  it('离线可用，不发起外部请求，不生成重复 DOM id', () => {
    for (const id of GAME_ICON_IDS) {
      expect(gameIcon(id)).toContain('viewBox="0 0 64 64"')
      expect(gameIcon(id)).not.toMatch(/<image|<script|<foreignObject|href=|\sid=/)
    }
    expect(gameIcon('<img src=x>')).not.toContain('<img')
  })
})
