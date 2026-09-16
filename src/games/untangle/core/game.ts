import { shuffle, type RandomSource } from '../../cards/core/cards'
export interface Point { x: number; y: number }
export type Edge = readonly [number, number]
export interface UntangleState { points: Point[]; target: Point[]; edges: Edge[]; moves: number }
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
export function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  const on = (a: Point, b: Point, p: Point) => Math.abs(cross(a,b,p)) < 1e-7 && p.x >= Math.min(a.x,b.x)-1e-7 && p.x <= Math.max(a.x,b.x)+1e-7 && p.y >= Math.min(a.y,b.y)-1e-7 && p.y <= Math.max(a.y,b.y)+1e-7
  return cross(a,b,c) * cross(a,b,d) < 0 && cross(c,d,a) * cross(c,d,b) < 0 || on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b)
}
export function crossedEdges(state: UntangleState): Set<number> {
  const result = new Set<number>()
  state.edges.forEach(([a,b], i) => state.edges.forEach(([c,d], j) => {
    if (i >= j || a === c || a === d || b === c || b === d) return
    if (intersects(state.points[a]!, state.points[b]!, state.points[c]!, state.points[d]!)) { result.add(i); result.add(j) }
  }))
  return result
}
export function won(state: UntangleState): boolean {
  return crossedEdges(state).size === 0 && state.points.every((p,i) => state.points.every((q,j) => i === j || Math.hypot(p.x-q.x,p.y-q.y) >= 45))
}
export function newGame(count = 5, random: RandomSource = Math.random): UntangleState {
  if (![5, 6, 7].includes(count)) throw new Error('无效难度')
  const target = Array.from({ length: count }, (_, i) => ({ x: 384 + Math.cos(i * Math.PI * 2 / count - Math.PI / 2) * 235, y: 485 + Math.sin(i * Math.PI * 2 / count - Math.PI / 2) * 235 }))
  const edges: Edge[] = Array.from({ length: count }, (_, i) => [i, (i+1)%count] as const)
  for (let i = 2; i < count-1; i++) edges.push([0,i])
  const points = shuffle(target, random)
  const state = { points, target, edges, moves: 0 }
  if (won(state)) [points[1], points[2]] = [points[2]!, points[1]!]
  return state
}
export function move(state: UntangleState, index: number, point: Point): UntangleState {
  if (!Number.isInteger(index) || !state.points[index] || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return state
  const p = { x: Math.max(70, Math.min(698, point.x)), y: Math.max(225, Math.min(745, point.y)) }
  return { ...state, points: state.points.map((old,i) => i === index ? p : old), moves: state.moves + 1 }
}
