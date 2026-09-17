import { describe, expect, it } from 'vitest'
import { gameIcon, GAME_ICON_IDS } from '../../src/app/icons'
import { LOBBY_SHEETS } from '../../src/app/icon-art'
import { puzzles } from '../../src/app/puzzles'

describe('本地游戏图标', () => {
  it('覆盖所有 20 款游戏且图形互不相同', () => {
    const ids = ['2048','gomoku','tetris','merge-fruit','freecell','klondike','spider','minesweeper', ...puzzles.map(game => game.id)]
    expect(GAME_ICON_IDS.toSorted()).toEqual(ids.toSorted())
    expect(new Set(ids.map(gameIcon)).size).toBe(ids.length)
  })
  it('离线可用，不发起外部请求，不生成重复 DOM id', () => {
    for (const id of GAME_ICON_IDS) {
      expect(gameIcon(id)).toContain('viewBox="0 0 64 64"')
      // data-icon 是精灵图管线的定位标记；除此之外不得出现其他 id 类属性。
      expect(gameIcon(id).replace(/ data-icon="[^"]*"/, '')).not.toMatch(/<image|<script|<foreignObject|href=|\sid=/)
    }
    expect(gameIcon('<img src=x>')).not.toContain('<img')
    // 敌意 id 不能从 data-icon 值逃逸出属性域注入新属性。
    expect(gameIcon('" onload="alert(1)" data-x="y')).not.toMatch(/ onload=/)
    expect(gameIcon('" onload="alert(1)" data-x="y')).not.toContain('data-x=')
  })
})

describe('大厅图标精灵图', () => {
  it('每张表的帧数与网格一致，游戏 id 合法且互不重复', () => {
    const known = new Set(GAME_ICON_IDS)
    const seen = new Set<string>()
    for (const sheet of LOBBY_SHEETS) {
      expect(sheet.ids).toHaveLength(sheet.cols * sheet.rows)
      for (const id of sheet.ids) {
        expect(known.has(id), `未知游戏 id: ${id}`).toBe(true)
        expect(seen.has(id), `跨表重复 id: ${id}`).toBe(false)
        seen.add(id)
      }
    }
  })
})
