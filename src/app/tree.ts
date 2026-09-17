// 小树成长（EXPERIENCE-2 §13）：孩子玩过的时间在游戏屋里留下温和、永久的痕迹。
// 纯本地 localStorage，不倒退、无签到、无倒计时奖励；坏档容忍。

export interface TreeProgress {
  version: 1
  leaves: number
  /** 已发过叶子的里程碑，保证每个自然目标只发一次。 */
  milestones: Record<string, boolean>
}

const KEY = 'family-game-room-tree-v1'

/** 阶段只前进不后退；阈值参考方案 §13.2 的七个阶段。 */
export const TREE_STAGES = [
  { name: '种子', at: 0 }, { name: '小芽', at: 3 }, { name: '小树', at: 8 },
  { name: '枝叶', at: 16 }, { name: '开花', at: 26 }, { name: '小鸟来了', at: 38 },
  { name: '树屋', at: 52 }
] as const

export function treeStage(leaves: number): { index: number; name: string } {
  let index = 0
  for (let i = 0; i < TREE_STAGES.length; i++) {
    if (leaves >= TREE_STAGES[i]!.at) index = i
  }
  return { index, name: TREE_STAGES[index]!.name }
}

export function readTree(): TreeProgress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!value || typeof value !== 'object') return { version: 1, leaves: 0, milestones: {} }
    const tree = value as Partial<TreeProgress>
    return {
      version: 1,
      leaves: Number.isSafeInteger(tree.leaves) && (tree.leaves ?? 0) >= 0 ? tree.leaves! : 0,
      milestones: tree.milestones && typeof tree.milestones === 'object' ? tree.milestones as Record<string, boolean> : {}
    }
  } catch {
    return { version: 1, leaves: 0, milestones: {} }
  }
}

/** 编号迁移：旧里程碑已发过叶时新名字继承该状态（不重复发叶、叶子数不变）。 */
export function adoptMilestone(from: string, to: string): void {
  if (!from || !to || from === to) return
  try {
    const tree = readTree()
    if (tree.milestones[from] && !tree.milestones[to]) {
      tree.milestones[to] = true
      delete tree.milestones[from]
      localStorage.setItem(KEY, JSON.stringify(tree))
    }
  } catch {
    // 存储不可用时跳过，不影响游戏。
  }
}

/** 首次达成某自然目标时发一片叶子；重复达成不再发。 */
export function awardLeaf(milestone: string): boolean {
  if (!milestone) return false
  try {
    const tree = readTree()
    if (tree.milestones[milestone]) return false
    tree.milestones[milestone] = true
    tree.leaves += 1
    localStorage.setItem(KEY, JSON.stringify(tree))
    return true
  } catch {
    // 存储不可用时静默放弃，不影响游戏本身。
    return false
  }
}
