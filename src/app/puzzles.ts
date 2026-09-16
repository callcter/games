export const puzzles = [
  { id: 'memory', title: '记忆翻牌', symbol: '🍎', ready: true, load: () => import('../games/memory') },
  { id: 'tangram', title: '七巧板', symbol: '◩', ready: true, load: () => import('../games/tangram') },
  { id: 'pipes', title: '接水管', symbol: '💧', ready: true, load: () => import('../games/pipes') },
  { id: 'sokoban', title: '推箱子', symbol: '📦', ready: true, load: () => import('../games/sokoban') },
  { id: 'bubbles', title: '泡泡龙', symbol: '🫧', ready: true, load: () => import('../games/bubbles') },
  { id: 'untangle', title: '解绳结', symbol: '✳', ready: true, load: () => import('../games/untangle') },
  { id: 'maze', title: '迷宫探险', symbol: '🐰', ready: true, load: () => import('../games/maze') },
  { id: 'nonogram', title: '数织', symbol: '▧', ready: true, load: () => import('../games/nonogram') }
] as const
