import { categoryOf, type Category } from './library'

export interface LobbyGame {
  id: string
  title: string
}

export const LOBBY_CATEGORIES = [
  {
    id: 'logic',
    title: '动脑筋',
    symbol: '✦',
    description: '慢慢想，找到规律'
  },
  {
    id: 'shapes',
    title: '拼一拼',
    symbol: '◇',
    description: '移动、组合、找出路'
  },
  {
    id: 'action',
    title: '手要快',
    symbol: '↯',
    description: '反应、节奏和手眼配合'
  },
  {
    id: 'cards',
    title: '一起玩',
    symbol: '♣',
    description: '棋类与经典纸牌'
  }
] as const satisfies readonly {
  id: Exclude<Category, 'all'>
  title: string
  symbol: string
  description: string
}[]

export function recentLobbyGames<T extends LobbyGame>(
  orderedRecent: readonly T[]
): {
  primary: T | null
  secondary: T[]
} {
  return {
    primary: orderedRecent[0] ?? null,
    secondary: orderedRecent.slice(1, 4)
  }
}

export function visibleLibraryIds(
  orderedIds: readonly string[],
  category: Category,
  expanded: boolean,
  previewLimit = 8
): string[] {
  const filtered = category === 'all'
    ? [...orderedIds]
    : orderedIds.filter(id => categoryOf(id) === category)

  if (category !== 'all' || expanded) return filtered
  return filtered.slice(0, Math.max(1, previewLimit))
}

export function categoryCount(
  ids: readonly string[],
  category: Exclude<Category, 'all'>
): number {
  return ids.filter(id => categoryOf(id) === category).length
}

export function categoryTitle(category: Category): string {
  if (category === 'all') return '全部游戏'
  return LOBBY_CATEGORIES.find(item => item.id === category)?.title ?? '游戏'
}
