export const puzzles = [
  { id: 'nonogram', title: '数织', symbol: '▧', ready: true, load: () => import('../games/nonogram') },
  { id: 'maze', title: '迷宫探险', symbol: '🐰', ready: true, load: () => import('../games/maze') },
  { id: 'pipes', title: '接水管', symbol: '💧', ready: true, load: () => import('../games/pipes') },
  { id: 'memory', title: '记忆翻牌', symbol: '🍎', ready: true, load: () => import('../games/memory') }
] as const
