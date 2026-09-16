export const PATTERNS = [
  { name: '小爱心', rows: ['01010', '11111', '11111', '01110', '00100'] },
  { name: '小房子', rows: ['00100', '01110', '11111', '11011', '11011'] },
  { name: '小树', rows: ['00100', '01110', '11111', '00100', '00100'] },
  { name: '小十字', rows: ['00100', '00100', '11111', '00100', '00100'] },
  { name: '小花', rows: ['00100', '01110', '11111', '01110', '00100'] }
] as const
export type Mark = -1 | 0 | 1
export interface NonogramState { level: number; marks: Mark[]; won: boolean }
export function clues(line: readonly number[]): number[] {
  const result: number[] = []; let count = 0
  for (const value of [...line, 0]) { if (value === 1) count++; else if (count) { result.push(count); count = 0 } }
  return result.length ? result : [0]
}
export function solution(level: number): number[] {
  const pattern = PATTERNS[level]
  if (!pattern) throw new Error('无效关卡')
  return pattern.rows.join('').split('').map(Number)
}
export function newGame(level = 0): NonogramState { solution(level); return { level, marks: Array<Mark>(25).fill(0), won: false } }
export function mark(state: NonogramState, index: number, value: Mark): NonogramState {
  if (state.won || !Number.isInteger(index) || index < 0 || index >= 25 || ![-1, 0, 1].includes(value)) return state
  const marks = state.marks.map((old, i) => i === index ? value : old)
  const target = solution(state.level)
  return { ...state, marks, won: target.every((filled, i) => (marks[i] === 1) === (filled === 1)) }
}

// 小棋盘逐行枚举，用于验证关卡唯一解；不在每次点击时执行。
export function countSolutions(target: readonly number[], limit = 2): number {
  const columnClues = Array.from({ length: 5 }, (_, x) => clues(Array.from({ length: 5 }, (_, y) => target[y * 5 + x]!)))
  const choices = Array.from({ length: 5 }, (_, y) => {
    const clue = clues(target.slice(y * 5, y * 5 + 5)).join(',')
    return Array.from({ length: 32 }, (_, mask) => Array.from({ length: 5 }, (_, x) => (mask >> x) & 1)).filter(row => clues(row).join(',') === clue)
  })
  let count = 0
  const search = (rows: number[][]): void => {
    if (count >= limit) return
    if (rows.length === 5) {
      if (columnClues.every((c, x) => clues(rows.map(row => row[x]!)).join(',') === c.join(','))) count++
      return
    }
    for (const row of choices[rows.length]!) search([...rows, row])
  }
  search([]); return count
}
