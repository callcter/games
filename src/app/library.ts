export const CATEGORIES = [
  { id: 'all', title: '全部游戏' }, { id: 'logic', title: '数字逻辑' },
  { id: 'shapes', title: '图形路线' }, { id: 'action', title: '轻松反应' }, { id: 'cards', title: '棋类纸牌' }
] as const
export type Category = typeof CATEGORIES[number]['id']
const GROUPS: Record<string, Category> = {
  '2048': 'logic', minesweeper: 'logic', sudoku: 'logic', nonogram: 'logic', memory: 'logic',
  tangram: 'shapes', maze: 'shapes', pipes: 'shapes', sokoban: 'shapes', untangle: 'shapes', 'water-sort': 'shapes', parking: 'shapes', 'tile-match': 'logic',
  tetris: 'action', 'merge-fruit': 'action', bubbles: 'action', 'pop-bubbles': 'action',
  'red-rain': 'action', 'whack-mole': 'action', 'fruit-slicer': 'action', gomoku: 'cards', freecell: 'cards', spider: 'cards'
}
export const categoryOf = (id: string): Category => GROUPS[id] ?? 'all'
const KEY = 'family-game-room-recent-v1'
export function readRecent(allowed: readonly string[]): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.includes(id)))].slice(0,4) : []
  } catch { return [] }
}
export function rememberRecent(id: string, allowed: readonly string[]): void {
  if (!allowed.includes(id)) return
  try { localStorage.setItem(KEY, JSON.stringify([id,...readRecent(allowed).filter(old => old !== id)].slice(0,4))) } catch { /* 不影响进入游戏 */ }
}

const ORDER_KEY = 'family-game-room-order-v1'

/** 读孩子自己排的图标顺序；过滤掉未知游戏，存档损坏或没存过时返回 null 用默认顺序。 */
export function readOrder(allowed: readonly string[]): string[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ORDER_KEY) ?? 'null')
    if (!Array.isArray(value) || !value.length) return null
    const known = [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.includes(id)))]
    return known.length ? known : null
  } catch { return null }
}

export function writeOrder(ids: readonly string[]): void {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)) } catch { /* 排序保存失败不影响游玩 */ }
}

export function clearOrder(): void {
  try { localStorage.removeItem(ORDER_KEY) } catch { /* 忽略 */ }
}

/** 自定义顺序在前，没排过的新游戏按默认顺序补在后面。 */
export function orderedIds(defaultIds: readonly string[], allowed: readonly string[]): string[] {
  const saved = readOrder(allowed)
  if (!saved) return [...defaultIds]
  return [...saved, ...defaultIds.filter(id => !saved.includes(id))]
}
