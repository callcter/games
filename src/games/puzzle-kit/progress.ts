import { loadGameSave, saveGame } from '../../platform/storage/game-storage'

// 新增益智游戏共用的跨会话进度：best 记数值型最好成绩，flags 记完成标记，
// levels 记关卡进度。结构变更时换新版本键并提供兼容迁移。
export interface PuzzleProgress {
  best: Record<string, number>
  flags: string[]
  levels: Record<string, number>
}

const SAVE_KEY = 'game-puzzle-progress-v1'

const asNumberMap = (value: unknown, integer = false): Record<string, number> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([key, number]) =>
      !['__proto__', 'constructor', 'prototype'].includes(key) && typeof number === 'number'
      && Number.isFinite(number) && number >= 0 && (!integer || Number.isSafeInteger(number)))) : {}

const emptyProgress = (): PuzzleProgress => ({ best: {}, flags: [], levels: {} })

let cache: PuzzleProgress | null = null
let pending: Promise<PuzzleProgress> | null = null
let writing = Promise.resolve()

function persist(progress: PuzzleProgress): void {
  const snapshot = structuredClone(progress)
  writing = writing.catch(() => undefined).then(() => saveGame(SAVE_KEY, snapshot))
}

export function loadProgress(): Promise<PuzzleProgress> {
  if (cache) return Promise.resolve(cache)
  pending ??= loadGameSave<Partial<PuzzleProgress>>(SAVE_KEY).then(saved => {
    cache = saved && typeof saved === 'object'
      ? { best: asNumberMap(saved.best), flags: Array.isArray(saved.flags) ? [...new Set(saved.flags.filter((flag): flag is string => typeof flag === 'string'))] : [], levels: asNumberMap(saved.levels, true) }
      : emptyProgress()
    return cache
  }).catch(() => { cache = emptyProgress(); return cache })
  return pending
}

// lowerIsBetter 为 true 时只有更小的值才会覆盖；记录后异步落盘，失败只告警不影响游戏。
export function recordBest(id: string, value: number, lowerIsBetter = true): void {
  void loadProgress().then(progress => {
    const old = progress.best[id]
    if (!Number.isFinite(value) || value < 0 || (old !== undefined && (lowerIsBetter ? old <= value : old >= value))) return
    progress.best[id] = value
    persist(progress)
  })
}

export function recordFlag(flag: string): void {
  void loadProgress().then(progress => {
    if (progress.flags.includes(flag)) return
    progress.flags.push(flag)
    persist(progress)
  })
}

export function recordLevel(id: string, level: number): void {
  void loadProgress().then(progress => {
    if (!Number.isSafeInteger(level) || level < 0 || progress.levels[id] === level) return
    progress.levels[id] = level
    persist(progress)
  })
}

// 使用提示后即使撤销，也仍属于练习记录，不覆盖独立完成的成绩。
export function recordRun(id: string, value: number, assisted: boolean, lowerIsBetter = true): void {
  recordBest(`${id}:${assisted ? 'assisted' : 'solo'}`, value, lowerIsBetter)
}

const HALLWAY_TIERS: [id: string, label: (tier: number) => string, tiers: number[]][] = [
  ['memory', tier => `${tier} 对最少尝试`, [24, 16, 8]],
  ['pipes', tier => `${tier}×${tier} 最少`, [6, 5, 4, 3]],
  ['maze', tier => `${tier}×${tier} 最少多走`, [11, 9, 7, 5]],
  ['untangle', tier => `${tier} 点最少`, [9, 8, 7, 6, 5]]
]

// 把进度摘要成大厅卡片的一行短文案；没有记录的游戏不出现在结果里。
export function summarizeProgress(progress: PuzzleProgress | null): Record<string, string> {
  if (!progress) return {}
  const lines: Record<string, string> = {}
  for (const [id, label, tiers] of HALLWAY_TIERS) {
    const tier = tiers.find(value => Object.keys(progress.best).some(key => key.startsWith(`${id}-${value}:`)))
    if (tier !== undefined) {
      const unit = id === 'memory' || id === 'untangle' ? '次' : '步'
      const prefix = `${id}-${tier}`
      const key = [`${prefix}:solo`, `${prefix}:single`, `${prefix}:duo`, `${prefix}:assisted`].find(key => progress.best[key] !== undefined)!
      const mode = key.endsWith(':assisted') ? '提示练习' : key.endsWith(':duo') ? '双人' : '独立'
      lines[id] = `${label(tier)} ${progress.best[key]}${unit} · ${mode}`
    } else {
      const old = tiers.find(value => progress.best[`${id}-${value}`] !== undefined)
      if (old !== undefined) lines[id] = `历史记录 ${progress.best[`${id}-${old}`]}（未分模式）`
    }
  }
  const bubbleMode = [4, 3].find(mode => progress.best[`bubbles-${mode}`] !== undefined)
  if (bubbleMode) lines.bubbles = `${bubbleMode} 色最高 ${progress.best[`bubbles-${bubbleMode}`]} 分`
  else if (progress.best.bubbles !== undefined) lines.bubbles = `历史最高 ${progress.best.bubbles} 分（未分难度）`
  const solvedLevels = new Set(Object.keys(progress.best).flatMap(key => { const match = /^sokoban-L(\d+)(?::(?:solo|assisted))?$/.exec(key); return match && Number(match[1]) < 10 ? [match[1]] : [] }))
  if (solvedLevels.size) lines.sokoban = `已过 ${solvedLevels.size} 关`
  const flagLine = (prefix: string, total: number, verb: string): string | undefined => {
    const count = progress.flags.filter(flag => flag.startsWith(prefix)).length
    return count ? `已${verb} ${count} / ${total} 幅` : undefined
  }
  lines.nonogram = flagLine('nonogram-', 9, '画') ?? ''
  const tangramLevels = new Set(progress.flags.flatMap(flag => { const match = /^tangram-([0-4])(?::(?:guided|silhouette):(?:solo|assisted))?$/.exec(flag); return match ? [match[1]] : [] }))
  lines.tangram = tangramLevels.size ? `已拼 ${tangramLevels.size} / 5 幅` : ''
  const sudokuTiers = [4, 6, 9].filter(size => progress.flags.includes(`sudoku-${size}`)).length
  lines.sudoku = sudokuTiers ? `已完成 ${sudokuTiers} / 3 档难度` : ''
  for (const key of ['nonogram', 'tangram', 'sudoku']) if (!lines[key]) delete lines[key]
  return lines
}
