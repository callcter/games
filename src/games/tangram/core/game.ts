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
export const UNIT = 60
export const SHAPES = POLYGONS.map((points,i) => points.map(([x,y]) => ({x:(x-CENTERS[i]!.x)*UNIT,y:(y-CENTERS[i]!.y)*UNIT})))
export const LEVEL_NAMES = ['七巧方块', '七巧菱形', '转转方块', '小房子', '小帆船']
export interface TangramState { level: number; pieces: Piece[]; targets: Pose[]; won: boolean }
export function vertices(index: number, pose: Pose): Point[] {
  const radians = pose.rotation * Math.PI / 4, cos = Math.cos(radians), sin = Math.sin(radians)
  return SHAPES[index]!.map(p => { const x = pose.flipped ? -p.x : p.x; return {x:pose.x+x*cos-p.y*sin,y:pose.y+x*sin+p.y*cos} })
}
export function newGame(level = 0): TangramState {
  if (!LEVEL_NAMES[level]) throw new Error('无效关卡')
  const rotation = [0,1,2][level] ?? 0, radians = rotation * Math.PI/4
  let targets = CENTERS.map(p => ({x:384+(p.x-2)*UNIT*Math.cos(radians)-(p.y-2)*UNIT*Math.sin(radians),y:420+(p.x-2)*UNIT*Math.sin(radians)+(p.y-2)*UNIT*Math.cos(radians),rotation,flipped:false}))
  if (level >= 3) {
    const unit = UNIT * Math.SQRT2, left = 384 - 2 * unit
    const pose = (x: number, y: number, rotation: number): Pose => ({ x: left + x * unit, y, rotation, flipped: false })
    const base = level === 3 ? 435 : 500
    targets = [
      pose(8/3, base - 2*unit/3, 1), pose(4/3, base - 2*unit/3, 1),
      pose(1, base + unit/3, 1), pose(8/3, base + 2*unit/3, 5),
      pose(1/3, base + 2*unit/3, 5), pose(3.5, base + unit/2, 1),
      pose(2, base + unit/2, 1)
    ]
    if (level === 4) {
      targets[0] = pose(8/3, 415 - 2*unit/3, 1)
      targets[1] = pose(4/3, 415 - 2*unit/3, 1)
      targets[3] = pose(10/3, base + unit/3, 1)
      targets[4] = pose(4/3, base - unit/3, 5)
      targets[5] = pose(2.5, base - unit/2, 1)
    }
  }
  const pieces = SHAPES.map((_,i) => ({x:110+(i%4)*180,y:i<4?650:775,rotation:0,flipped:false,placed:false}))
  return {level,pieces,targets,won:false}
}
function signedArea(points: Point[]): number {
  return points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]!; return sum + p.x * q.y - p.y * q.x }, 0) / 2
}
// 所有七巧板块均为凸多边形，逐边裁剪求相交面积，不靠采样近似。
export function intersectionArea(subject: Point[], clip: Point[]): number {
  let result = subject
  const sign = Math.sign(signedArea(clip))
  for (let i = 0; i < clip.length && result.length; i++) {
    const a = clip[i]!, b = clip[(i + 1) % clip.length]!
    const side = (p: Point): number => sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x))
    const input = result; result = []
    input.forEach((p, j) => {
      const q = input[(j + 1) % input.length]!, sp = side(p), sq = side(q)
      if (sp >= -1e-8) result.push(p)
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq)
        result.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) })
      }
    })
  }
  return Math.abs(signedArea(result))
}

function fitsOutline(state: TangramState, index: number, pose: Pose): boolean {
  const actual = vertices(index, pose), area = Math.abs(signedArea(actual))
  const covered = state.targets.reduce((sum, target, i) => sum + intersectionArea(actual, vertices(i, target)), 0)
  return Math.abs(covered - area) < 0.01 && state.pieces.every((p, i) => i === index || !p.placed || intersectionArea(actual, vertices(i, p)) < 0.01)
}

export function place(state: TangramState, index: number, pose: Pose, silhouette = false): TangramState {
  if (state.won || !state.pieces[index] || state.pieces[index]!.placed || !Number.isFinite(pose.x) || !Number.isFinite(pose.y) || !Number.isInteger(pose.rotation)) return state
  const actual = vertices(index,pose)
  let snapped: Pose | undefined
  const targets = silhouette ? state.targets : [state.targets[index]!]
  for (const target of targets) {
    for (const flipped of silhouette ? [false, true] : [target.flipped]) {
      for (const rotation of silhouette ? [0,1,2,3,4,5,6,7] : [target.rotation]) {
        const candidate = { x: target.x, y: target.y, rotation, flipped }
        const polygon = vertices(index, candidate)
        if (actual.every(p => polygon.some(q => Math.hypot(p.x-q.x,p.y-q.y) < 28)) && fitsOutline(state, index, candidate)) snapped = candidate
      }
    }
  }
  // 剪影允许其他合法拼法，不绑定固定的分块方案。
  if (!snapped && silhouette && fitsOutline(state, index, pose)) snapped = pose
  const pieces = state.pieces.map((p,i) => i === index ? {...(snapped ?? pose),placed:!!snapped} : p)
  return {...state,pieces,won:pieces.every(p=>p.placed)}
}
