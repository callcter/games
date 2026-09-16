export const CATEGORIES = [
  { id: 'all', title: '全部游戏' }, { id: 'logic', title: '数字逻辑' },
  { id: 'shapes', title: '图形路线' }, { id: 'action', title: '轻松反应' }, { id: 'cards', title: '棋类纸牌' }
] as const
export type Category = typeof CATEGORIES[number]['id']
const GROUPS: Record<string, Category> = {
  '2048': 'logic', minesweeper: 'logic', sudoku: 'logic', nonogram: 'logic', memory: 'logic',
  tangram: 'shapes', maze: 'shapes', pipes: 'shapes', sokoban: 'shapes', untangle: 'shapes',
  tetris: 'action', 'merge-fruit': 'action', bubbles: 'action', gomoku: 'cards', freecell: 'cards', spider: 'cards'
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
