import { shuffle, type RandomSource } from '../../cards/core/cards'
import { DIRECTIONS, OPPOSITE, neighbor } from '../../pipes/core/game'
export interface MazeState { size: number; passages: number[]; player: number; trail: number[]; won: boolean }
export function newGame(size = 5, random: RandomSource = Math.random): MazeState {
  if (![5, 7, 9, 11].includes(size)) throw new Error('无效尺寸')
  const passages = Array<number>(size * size).fill(0), visited = new Set([0]), stack = [0]
  while (stack.length) {
    const current = stack.at(-1)!
    const direction = shuffle([0, 1, 2, 3], random).find(d => { const n = neighbor(current, d, size); return n >= 0 && !visited.has(n) })
    if (direction === undefined) { stack.pop(); continue }
    const next = neighbor(current, direction, size)
    passages[current] = passages[current]! | DIRECTIONS[direction]!
    passages[next] = passages[next]! | OPPOSITE[direction]!
    visited.add(next); stack.push(next)
  }
  return { size, passages, player: 0, trail: [], won: false }
}
export function move(state: MazeState, direction: number): MazeState {
  if (state.won || !Number.isInteger(direction) || direction < 0 || direction > 3 || !(state.passages[state.player]! & DIRECTIONS[direction]!)) return state
  const player = neighbor(state.player, direction, state.size)
  if (player < 0) return state
  return { ...state, player, trail: [...state.trail, state.player], won: player === state.size * state.size - 1 }
}
export function undo(state: MazeState): MazeState {
  return state.trail.length ? { ...state, player: state.trail.at(-1)!, trail: state.trail.slice(0, -1), won: false } : state
}

/** 输入是以格为单位的指尖坐标；沿实际线段逐格走，碰墙/斜穿角落立即停止。 */
export function dragAlong(state: MazeState, x1: number, y1: number, x2: number, y2: number): MazeState {
  if (state.won || ![x1,y1,x2,y2].every(v => Number.isFinite(v) && v >= 0 && v < state.size)) return state
  if (Math.floor(y1) * state.size + Math.floor(x1) !== state.player) return state
  const samples = Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1)) * 8)
  let next = state
  for (let i=1;i<=samples;i++) {
    const x=Math.floor(x1+(x2-x1)*i/samples), y=Math.floor(y1+(y2-y1)*i/samples)
    const target=y*state.size+x
    if (target === next.player) continue
    const d=[0,1,2,3].find(direction=>neighbor(next.player,direction,state.size)===target)
    if (d === undefined) break
    const moved=move(next,d)
    if (moved === next) break
    next=moved
  }
  return next
}
export function path(state: MazeState): number[] {
  const queue = [[state.player]], seen = new Set([state.player])
  for (let i = 0; i < queue.length; i++) {
    const route = queue[i]!, current = route.at(-1)!
    if (current === state.size * state.size - 1) return route
    DIRECTIONS.forEach((bit, d) => {
      const next = neighbor(current, d, state.size)
      if (!(state.passages[current]! & bit) || next < 0 || seen.has(next)) return
      seen.add(next); queue.push([...route, next])
    })
  }
  return []
}
