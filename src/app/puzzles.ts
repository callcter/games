export const puzzles = [
  { id: 'memory', title: '记忆翻牌', symbol: '🍎', ready: true, load: () => import('../games/memory') }
] as const
