export const LEVELS = [
  ['#######', '#     #', '# @$ .#', '#     #', '#######'],
  ['#######', '#  .  #', '#  $  #', '#  @  #', '#     #', '#######'],
  ['#######', '# . . #', '# $ $ #', '#  @  #', '#     #', '#######'],
  ['#######', '#   . #', '# # $ #', '# $ . #', '# @   #', '#######'],
  ['#######', '# . . #', '#  #  #', '# $ $ #', '#  @  #', '#     #', '#######'],
  ['#######', '#     #', '# .$  #', '# .$@ #', '#     #', '#######'],
  ['#######', '#     #', '# .#  #', '# $#  #', '# .$@ #', '#     #', '#######'],
  ['########', '#   #  #', '# $ .  #', '#  #@# #', '# . $  #', '#   #  #', '########'],
  ['########', '#      #', '#  $$  #', '# $..  #', '#  .@  #', '#      #', '########'],
  ['########', '#  #   #', '#  $ . #', '#@ $#  #', '# .$.  #', '#  #   #', '########']
,
  // Wave 4 内容扩展：固定种子（mulberry32 20260919）随机生成 + BFS 验证可解与最优步数，
  // 按 4-7 / 8-12 / 13-30 三段难度带各收 8/7/5 关，全部在 solve 的 5 万节点预算内；
  // PAR 由求解器计算并由测试逐一校验。
  ['########', '#      #', '#      #', '#.  #  #', '#$     #', '#    @ #', '########'],
  ['#######', '##   ##', '## @ ##', '#    ##', '#  $ .#', '#######'],
  ['########', '# # @# #', '#      #', '# . #  #', '# $    #', '#      #', '########'],
  ['########', '### .  #', '#      #', '#    @ #', '#   $  #', '# #    #', '########'],
  ['#######', '# . $ #', '#     #', '# @   #', '##    #', '#######'],
  ['#######', '#     #', '#     #', '##    #', '# $#  #', '# . @ #', '#######'],
  ['#######', '#  .  #', '#   # #', '##$   #', '##@   #', '#######'],
  ['#######', '#     #', '##. $ #', '#     #', '## @  #', '#######'],
  ['#######', '# .  ##', '#  $@ #', '#     #', '# $ . #', '#######'],
  ['########', '#   @ .#', '#      #', '#    $ #', '#     ##', '#  #   #', '########'],
  ['#######', '# $.  #', '#  @  #', '#     #', '#     #', '#   $.#', '#######'],
  ['########', '#@     #', '# #    #', '#    $ #', '## ### #', '###   .#', '########'],
  ['#######', '# # # #', '#  $ .#', '##   ##', '# $ . #', '# @   #', '#######'],
  ['########', '#   @. #', '##     #', '#      #', '#   $  #', '# #   ##', '########'],
  ['#######', '#     #', '#  $ $#', '## . @#', '#   #.#', '#######'],
  ['########', '#  # . #', '# $$   #', '#  #   #', '#      #', '#    .@#', '########'],
  ['########', '## @  ##', '#.     #', '#$   $ #', '#   .  #', '########'],
  ['########', '# ##   #', '#    $##', '# #   @#', '#.     #', '#      #', '########'],
  ['########', '# ##   #', '#   #$ #', '#@ #  .#', '#      #', '#     ##', '########'],
  ['########', '#     ##', '#.   $ #', '# @  # #', '#      #', '#    $.#', '########']] as const
// 每关最优移动步数，由 solve 的广度优先搜索预计算，测试会逐一校验一致。
export const PAR = [2, 1, 6, 12, 9, 4, 11, 16, 14, 27, 5, 5, 7, 6, 7, 5, 5, 6, 9, 9, 10, 10, 9, 10, 10, 26, 14, 13, 18, 13] as const
// 新游戏从需要规划多个箱子的关卡起步；旧关卡仍能恢复存档。
export const CHALLENGE_LEVELS = PAR.flatMap((steps, index) => steps >= 8 ? [index] : [])
export function stars(level: number, moves: number): number {
  const par = PAR[level]
  if (par === undefined || !Number.isFinite(moves)) return 0
  if (moves <= par) return 3
  if (moves <= Math.ceil(par * 1.4)) return 2
  return 1
}
export interface SokobanState { width: number; height: number; walls: number[]; goals: number[]; boxes: number[]; player: number; moves: number; won: boolean }
export function newGame(level = 0): SokobanState {
  const rows = LEVELS[level]; if (!rows) throw new Error('无效关卡')
  const state: SokobanState = { width: rows[0].length, height: rows.length, walls: [], goals: [], boxes: [], player: -1, moves: 0, won: false }
  rows.join('').split('').forEach((v, i) => { if (v === '#') state.walls.push(i); if (v === '.') state.goals.push(i); if (v === '$') state.boxes.push(i); if (v === '@') state.player = i })
  return state
}
export function move(state: SokobanState, direction: number): SokobanState {
  if (state.won || !Number.isInteger(direction) || direction < 0 || direction > 3) return state
  const offset = [-state.width, 1, state.width, -1][direction]!
  const next = state.player + offset
  const valid = (from: number, to: number): boolean => to >= 0 && to < state.width * state.height && !state.walls.includes(to) && (direction % 2 === 0 || Math.floor(from / state.width) === Math.floor(to / state.width))
  if (!valid(state.player, next)) return state
  let boxes = state.boxes
  if (boxes.includes(next)) {
    const dest = next + offset
    if (!valid(next, dest) || boxes.includes(dest)) return state
    boxes = boxes.map(box => box === next ? dest : box)
  }
  return { ...state, boxes, player: next, moves: state.moves + 1, won: boxes.every(box => state.goals.includes(box)) }
}
export function solve(state: SokobanState, limit = 50000): number[] | null {
  const key = (s: SokobanState) => `${s.player}:${[...s.boxes].sort((a,b) => a-b).join(',')}`
  const queue = [{ state, path: [] as number[] }], seen = new Set([key(state)])
  for (let head = 0; head < queue.length && head < limit; head++) {
    const current = queue[head]!
    if (current.state.won) return current.path
    for (let d = 0; d < 4; d++) {
      const next = move(current.state, d), id = key(next)
      if (seen.has(id)) continue
      seen.add(id); queue.push({ state: next, path: [...current.path, d] })
    }
  }
  return null
}
