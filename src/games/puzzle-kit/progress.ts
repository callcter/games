import { loadGameSave, saveGame } from '../../platform/storage/game-storage'

// 新增益智游戏共用的跨会话进度：best 记数值型最好成绩，flags 记完成标记，
// levels 记关卡进度。结构变更时换新版本键并提供兼容迁移。
export interface PuzzleProgress {
  best: Record<string, number>
  flags: string[]
  levels: Record<string, number>
}

const SAVE_KEY = 'game-puzzle-progress-v1'

const asNumberMap = (value: unknown): Record<string, number> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, number> : {}

const emptyProgress = (): PuzzleProgress => ({ best: {}, flags: [], levels: {} })

let cache: PuzzleProgress | null = null
let pending: Promise<PuzzleProgress> | null = null

export function loadProgress(): Promise<PuzzleProgress> {
  if (cache) return Promise.resolve(cache)
  pending ??= loadGameSave<Partial<PuzzleProgress>>(SAVE_KEY).then(saved => {
    cache = saved && typeof saved === 'object'
      ? { best: asNumberMap(saved.best), flags: Array.isArray(saved.flags) ? saved.flags : [], levels: asNumberMap(saved.levels) }
      : emptyProgress()
    return cache
  })
  return pending
}

// lowerIsBetter 为 true 时只有更小的值才会覆盖；记录后异步落盘，失败只告警不影响游戏。
export function recordBest(id: string, value: number, lowerIsBetter = true): void {
  void loadProgress().then(progress => {
    const old = progress.best[id]
    if (!Number.isFinite(value) || (old !== undefined && (lowerIsBetter ? old <= value : old >= value))) return
    progress.best[id] = value
    void saveGame(SAVE_KEY, progress)
  })
}

export function recordFlag(flag: string): void {
  void loadProgress().then(progress => {
    if (progress.flags.includes(flag)) return
    progress.flags.push(flag)
    void saveGame(SAVE_KEY, progress)
  })
}

export function recordLevel(id: string, level: number): void {
  void loadProgress().then(progress => {
    if (!Number.isFinite(level) || progress.levels[id] === level) return
    progress.levels[id] = level
    void saveGame(SAVE_KEY, progress)
  })
}

const HALLWAY_TIERS: [id: string, label: (tier: number) => string, tiers: number[]][] = [
  ['memory', tier => `${tier} 对最快`, [24, 16, 8]],
  ['pipes', tier => `${tier}×${tier} 最少`, [6, 5, 4, 3]],
  ['maze', tier => `${tier}×${tier} 最少`, [11, 9, 7, 5]],
  ['untangle', tier => `${tier} 点最少`, [9, 8, 7, 6, 5]]
]

// 把进度摘要成大厅卡片的一行短文案；没有记录的游戏不出现在结果里。
export function summarizeProgress(progress: PuzzleProgress | null): Record<string, string> {
  if (!progress) return {}
  const lines: Record<string, string> = {}
  for (const [id, label, tiers] of HALLWAY_TIERS) {
    const tier = tiers.find(value => progress.best[`${id}-${value}`] !== undefined)
    if (tier !== undefined) {
      const unit = id === 'memory' || id === 'untangle' ? '次' : '步'
      lines[id] = `${label(tier)} ${progress.best[`${id}-${tier}`]}${unit}`
    }
  }
  if (progress.best.bubbles !== undefined) lines.bubbles = `最高 ${progress.best.bubbles} 分`
  const solvedLevels = Object.keys(progress.best).filter(key => key.startsWith('sokoban-L'))
  if (solvedLevels.length) lines.sokoban = `已过 ${solvedLevels.length} 关`
  const flagLine = (prefix: string, total: number, verb: string): string | undefined => {
    const count = progress.flags.filter(flag => flag.startsWith(prefix)).length
    return count ? `已${verb} ${count} / ${total} 幅` : undefined
  }
  lines.nonogram = flagLine('nonogram-', 9, '画') ?? ''
  lines.tangram = flagLine('tangram-', 3, '拼') ?? ''
  lines.sudoku = flagLine('sudoku-', 3, '解') ?? ''
  for (const key of ['nonogram', 'tangram', 'sudoku']) if (!lines[key]) delete lines[key]
  return lines
}
