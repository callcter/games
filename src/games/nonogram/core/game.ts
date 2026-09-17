const BASE_PATTERNS = [
  { name: '小爱心', rows: ['01010', '11111', '11111', '01110', '00100'] },
  { name: '小房子', rows: ['00100', '01110', '11111', '11011', '11011'] },
  { name: '小树', rows: ['00100', '01110', '11111', '00100', '00100'] },
  { name: '小十字', rows: ['00100', '00100', '11111', '00100', '00100'] },
  { name: '小花', rows: ['00100', '01110', '11111', '01110', '00100'] },
  { name: '大爱心', rows: ['.##....##.', '####..####', '##########', '##########', '.########.', '..######..', '...####...', '....##....', '..........', '..........'] },
  { name: '小猫咪', rows: ['##......##', '##......##', '##########', '##.####.##', '##########', '.########.', '..##..##..', '..######..', '...####...', '....##....'] },
  { name: '小帆船', rows: ['..........', '....#.....', '...##.....', '..###.....', '.####.....', '#####.....', '.#######..', '#########.', '##########', '..######..'] },
  { name: '小火箭', rows: ['....##....', '...####...', '...####...', '..######..', '..##..##..', '..######..', '.########.', '.########.', '###....###', '##......##'] }
] as const

// 内容扩展（EXPERIENCE-2 Wave 4）：镜像变体是不同的线索关卡，且唯一解性质在
// 双射变换下保持（若镜像题有两解，映回原图即原题两解，矛盾）。对称图案的
// 重复变体被过滤。5×5 组在前、10×10 组在后，形成自然的难度梯度。
const flipH = (rows: readonly string[]): string[] => rows.map(row => [...row].reverse().join(''))
const flipV = (rows: readonly string[]): string[] => [...rows].reverse()
const flipT = (rows: readonly string[]): string[] => rows[0]!.split('').map((_, x) => rows.map(row => row[x]).join(''))
const invert = (rows: readonly string[]): string[] => rows.map(row => [...row].map(ch => ch === '#' ? '.' : ch === '1' ? '0' : ch === '.' ? '#' : '1').join(''))
// 镜/影/转（180°）/转置 + 各自的反色；全部是保持唯一解的双射变换，对称图案去重。
const VARIANTS: Array<{ suffix: string; flip: (rows: readonly string[]) => readonly string[] }> = [
  { suffix: '·镜', flip: flipH },
  { suffix: '·影', flip: flipV },
  { suffix: '·转', flip: rows => flipV(flipH(rows)) },
  { suffix: '·斜', flip: flipT },
  { suffix: '·夜', flip: rows => invert(rows) },
  { suffix: '·夜镜', flip: rows => invert(flipH(rows)) },
  { suffix: '·夜影', flip: rows => invert(flipV(rows)) },
  { suffix: '·夜转', flip: rows => invert(flipV(flipH(rows))) },
  { suffix: '·夜斜', flip: rows => invert(flipT(rows)) }
]
// 原图 0-8 保持既有顺序与索引（旧存档 level 和 nonogram-N 完成记录的身份不变，
// 旧 10×10 棋盘可直接恢复）；变体统一追加在 9 之后，5×5 变体段先于 10×10 变体段。
const seen = new Set<string>()
const expanded: Array<{ name: string; rows: readonly string[] }> = [...BASE_PATTERNS]
for (const pattern of BASE_PATTERNS) seen.add(pattern.rows.join('/'))
for (const pattern of BASE_PATTERNS) {
  for (const variant of VARIANTS) {
    const rows = variant.flip(pattern.rows)
    const key = rows.join('/')
    if (seen.has(key)) continue
    seen.add(key)
    expanded.push({ name: `${pattern.name}${variant.suffix}`, rows })
  }
}
export const PATTERNS = expanded
export const BASE_PATTERN_COUNT = BASE_PATTERNS.length

// ---------- 三代关卡编号的存档兼容（EXPERIENCE-2 二轮验收 R2） ----------
// 已发布交错版（f352e7f..c4fb94e 线上窗口）按「原图与其变体连续」编号；
// 重放同一变体规则与去重得到该代顺序，映射到当前（原图优先）编号。
// 图案集合两代一致，仅顺序不同，因此映射是精确的双射而非猜测。
const v2Order: Array<{ name: string; rows: readonly string[] }> = []
{
  const seen = new Set<string>()
  for (const pattern of BASE_PATTERNS) {
    seen.add(pattern.rows.join('/'))
    v2Order.push(pattern)
    for (const variant of VARIANTS) {
      const rows = variant.flip(pattern.rows)
      const key = rows.join('/')
      if (seen.has(key)) continue
      seen.add(key)
      v2Order.push({ name: `${pattern.name}${variant.suffix}`, rows })
    }
  }
}
const v3IndexByName = new Map(expanded.map((pattern, index) => [pattern.name, index]))
export const LEGACY_V2_TO_V3: readonly number[] = v2Order.map(pattern => {
  const index = v3IndexByName.get(pattern.name)
  if (index === undefined) throw new Error(`交错版图案 ${pattern.name} 在当前图案库中缺失`)
  return index
})
/** 交错版（已发布扩容版）关卡编号 → 当前编号；越界返回 undefined。 */
export function legacyV2ToV3(level: number): number | undefined {
  return Number.isInteger(level) && level >= 0 && level < LEGACY_V2_TO_V3.length ? LEGACY_V2_TO_V3[level] : undefined
}
export type Mark = -1 | 0 | 1
export interface NonogramState { level: number; marks: Mark[]; won: boolean }
export function clues(line: readonly number[]): number[] {
  const result: number[] = []; let count = 0
  for (const value of [...line, 0]) { if (value === 1) count++; else if (count) { result.push(count); count = 0 } }
  return result.length ? result : [0]
}
export function patternSize(level: number): number {
  const pattern = PATTERNS[level]
  if (!pattern) throw new Error('无效关卡')
  return pattern.rows[0]!.length
}
export function solution(level: number): number[] {
  const pattern = PATTERNS[level]
  if (!pattern) throw new Error('无效关卡')
  return pattern.rows.join('').split('').map(char => (char === '#' || char === '1' ? 1 : 0))
}
export function newGame(level = 0): NonogramState { const size = patternSize(level); return { level, marks: Array<Mark>(size * size).fill(0), won: false } }
export function mark(state: NonogramState, index: number, value: Mark): NonogramState {
  const total = patternSize(state.level) ** 2
  if (state.won || !Number.isInteger(index) || index < 0 || index >= total || ![-1, 0, 1].includes(value)) return state
  if (state.marks[index] === value) return state
  const marks = state.marks.map((old, i) => i === index ? value : old)
  const target = solution(state.level)
  return { ...state, marks, won: target.every((filled, i) => (marks[i] === 1) === (filled === 1)) }
}

export function lineCells(from: number, to: number, size: number): number[] {
  if (!Number.isInteger(size) || size < 1 || ![from,to].every(i => Number.isInteger(i) && i >= 0 && i < size*size)) return []
  const x = from % size, y = Math.floor(from/size), dx = to % size - x, dy = Math.floor(to/size) - y
  const steps = Math.max(Math.abs(dx), Math.abs(dy))
  return steps ? Array.from({ length: steps+1 }, (_,i) => Math.round(y+dy*i/steps)*size + Math.round(x+dx*i/steps)) : [from]
}

// 逐行枚举 + 列前缀剪枝，验证关卡唯一解；只在测试里执行，不在每次点击时运行。
export function countSolutions(target: readonly number[], limit = 2): number {
  const size = Math.sqrt(target.length)
  if (!Number.isInteger(size)) throw new Error('图案必须是正方形')
  const key = (clue: readonly number[]): string => clue.length ? clue.join(',') : '0'
  const columnClues = Array.from({ length: size }, (_, x) => clues(Array.from({ length: size }, (_, y) => target[y * size + x]!)))
  const rowOptions = Array.from({ length: size }, (_, y) => {
    const clue = key(clues(target.slice(y * size, y * size + size)))
    return Array.from({ length: 2 ** size }, (_, mask) => Array.from({ length: size }, (_, x) => (mask >> x) & 1))
      .filter(row => key(clues(row)) === clue)
  })
  const columns = Array.from({ length: size }, () => ({ done: [] as number[], run: 0 }))
  const columnOk = (x: number, filled: number, y: number): boolean => {
    const column = columns[x]!, clue = columnClues[x]!
    let { done, run } = column
    if (filled) {
      run += 1
      if (done.length >= clue.length || run > clue[done.length]!) return false
    } else if (run) {
      done = [...done, run]
      if (done.length > clue.length || clue[done.length - 1] !== done.at(-1)) return false
      run = 0
    }
    if (y === size - 1) return key(run ? [...done, run] : done) === key(clue)
    const rest = run ? clue.slice(done.length + 1) : clue.slice(done.length)
    let need = rest.length ? rest.reduce((sum, value) => sum + value, 0) + rest.length - 1 : 0
    if (run) need += Math.max(0, clue[done.length]! - run) + (rest.length ? 1 : 0)
    return size - y - 1 >= need
  }
  let count = 0
  const search = (y: number): void => {
    if (count >= limit) return
    if (y === size) { count++; return }
    for (const row of rowOptions[y]!) {
      if (!row.every((filled, x) => columnOk(x, filled, y))) continue
      const snapshot = columns.map(column => ({ done: [...column.done], run: column.run }))
      row.forEach((filled, x) => {
        if (filled) columns[x]!.run += 1
        else if (columns[x]!.run) { columns[x]!.done.push(columns[x]!.run); columns[x]!.run = 0 }
      })
      search(y + 1)
      row.forEach((_, x) => { columns[x]!.done = snapshot[x]!.done; columns[x]!.run = snapshot[x]!.run })
    }
  }
  search(0)
  return count
}
