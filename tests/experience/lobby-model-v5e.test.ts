import { describe, expect, it } from 'vitest'
import {
  LOBBY_CATEGORIES,
  categoryCount,
  categoryTitle,
  recentLobbyGames,
  visibleLibraryIds
} from '../../src/app/lobby-model'

const ids = [
  '2048',
  'gomoku',
  'tetris',
  'merge-fruit',
  'freecell',
  'klondike',
  'spider',
  'minesweeper',
  'memory',
  'tangram',
  'pipes',
  'sokoban',
  'bubbles',
  'untangle',
  'maze',
  'nonogram',
  'sudoku',
  'pop-bubbles',
  'red-rain',
  'whack-mole',
  'fruit-slicer',
  'water-sort',
  'parking',
  'tile-match'
]

describe('v5-E lobby information architecture', () => {
  it('uses the latest game as the primary resume target without duplicating it', () => {
    const recent = [
      { id: 'maze', title: '迷宫探险' },
      { id: 'memory', title: '记忆翻牌' },
      { id: 'tetris', title: '俄罗斯方块' },
      { id: 'pipes', title: '接水管' }
    ]

    const result = recentLobbyGames(recent)
    expect(result.primary?.id).toBe('maze')
    expect(result.secondary.map(game => game.id)).toEqual([
      'memory',
      'tetris',
      'pipes'
    ])
  })

  it('shows only the first eight ordered games in the collapsed all-games library', () => {
    expect(
      visibleLibraryIds(ids, 'all', false)
    ).toEqual(ids.slice(0, 8))
  })

  it('preserves the child-defined order in the collapsed preview', () => {
    const custom = [
      'maze',
      'memory',
      'pipes',
      ...ids.filter(id => !['maze', 'memory', 'pipes'].includes(id))
    ]

    expect(
      visibleLibraryIds(custom, 'all', false)
    ).toEqual(custom.slice(0, 8))
  })

  it('shows the whole selected category instead of truncating it to the preview size', () => {
    const shapes = visibleLibraryIds(ids, 'shapes', false)
    expect(shapes).toContain('maze')
    expect(shapes).toContain('parking')
    expect(shapes).toContain('water-sort')
    expect(shapes).not.toContain('2048')
    expect(shapes.length).toBe(categoryCount(ids, 'shapes'))
  })

  it('expands all 24 games only when requested', () => {
    expect(visibleLibraryIds(ids, 'all', true)).toHaveLength(24)
  })

  it('keeps the four child-facing discovery categories stable', () => {
    expect(LOBBY_CATEGORIES.map(category => category.id)).toEqual([
      'logic',
      'shapes',
      'action',
      'cards'
    ])
    expect(categoryTitle('all')).toBe('全部游戏')
    expect(categoryTitle('action')).toBe('手要快')
  })
})
