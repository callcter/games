export const PATTERNS = [
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
  const marks = state.marks.map((old, i) => i === index ? value : old)
  const target = solution(state.level)
  return { ...state, marks, won: target.every((filled, i) => (marks[i] === 1) === (filled === 1)) }
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
