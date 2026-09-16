export interface Point { x: number; y: number }
export interface Pose extends Point { rotation: number; flipped: boolean }
export interface Piece extends Pose { placed: boolean }
const POLYGONS = [
  [[0,0],[4,0],[2,2]], [[0,0],[2,2],[0,4]],
  [[4,2],[4,4],[2,4]], [[2,2],[3,1],[3,3]],
  [[0,4],[1,3],[2,4]], [[1,3],[2,2],[3,3],[2,4]],
  [[3,1],[4,0],[4,2],[3,3]]
] as const
export const CENTERS = POLYGONS.map(points => ({x:points.reduce((s,p)=>s+p[0],0)/points.length,y:points.reduce((s,p)=>s+p[1],0)/points.length}))
export const SHAPES = POLYGONS.map((points,i) => points.map(([x,y]) => ({x:(x-CENTERS[i]!.x)*72,y:(y-CENTERS[i]!.y)*72})))
export const LEVEL_NAMES = ['七巧方块', '七巧菱形', '转转方块']
export interface TangramState { level: number; pieces: Piece[]; targets: Pose[]; won: boolean }
export function vertices(index: number, pose: Pose): Point[] {
  const radians = pose.rotation * Math.PI / 4, cos = Math.cos(radians), sin = Math.sin(radians)
  return SHAPES[index]!.map(p => { const x = pose.flipped ? -p.x : p.x; return {x:pose.x+x*cos-p.y*sin,y:pose.y+x*sin+p.y*cos} })
}
export function newGame(level = 0): TangramState {
  if (!LEVEL_NAMES[level]) throw new Error('无效关卡')
  const rotation = [0,1,2][level]!, radians = rotation * Math.PI/4
  const targets = CENTERS.map(p => ({x:384+(p.x-2)*72*Math.cos(radians)-(p.y-2)*72*Math.sin(radians),y:410+(p.x-2)*72*Math.sin(radians)+(p.y-2)*72*Math.cos(radians),rotation,flipped:false}))
  const pieces = SHAPES.map((_,i) => ({x:110+(i%4)*180,y:i<4?660:760,rotation:0,flipped:false,placed:false}))
  return {level,pieces,targets,won:false}
}
export function place(state: TangramState, index: number, pose: Pose): TangramState {
  if (state.won || !state.pieces[index] || state.pieces[index]!.placed || !Number.isFinite(pose.x) || !Number.isFinite(pose.y) || !Number.isInteger(pose.rotation)) return state
  const actual = vertices(index,pose), target = vertices(index,state.targets[index]!)
  const close = actual.every(p => target.some(q => Math.hypot(p.x-q.x,p.y-q.y) < 28))
  const pieces = state.pieces.map((p,i) => i === index ? {...(close?state.targets[index]!:pose),placed:close} : p)
  return {...state,pieces,won:pieces.every(p=>p.placed)}
}
