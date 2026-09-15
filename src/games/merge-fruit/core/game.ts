export const FRUIT_LEVELS = [
  { name: '樱桃', color: 0xd83c4b, accent: 0xff7882, radius: 14 },
  { name: '草莓', color: 0xf05a61, accent: 0xff9290, radius: 19 },
  { name: '葡萄', color: 0x8e63be, accent: 0xc6a1e6, radius: 24 },
  { name: '橘子', color: 0xf39a48, accent: 0xffc06d, radius: 31 },
  { name: '柠檬', color: 0xe7cd4d, accent: 0xffe978, radius: 40 },
  { name: '苹果', color: 0xd85e54, accent: 0xf48a75, radius: 51 },
  { name: '桃子', color: 0xef9c8e, accent: 0xffc0aa, radius: 64 },
  { name: '椰子', color: 0x9b6d4d, accent: 0xc6966c, radius: 81 },
  { name: '菠萝', color: 0xd8a93d, accent: 0xf2cf62, radius: 100 },
  { name: '哈密瓜', color: 0x91b85c, accent: 0xbad67b, radius: 121 },
  { name: '大西瓜', color: 0x4f9d65, accent: 0x79c985, radius: 145 }
] as const

export type FruitLevel = number
export type RandomSource = () => number

const DROP_LEVELS = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4] as const

export interface MergeResult {
  nextLevel: FruitLevel
  score: number
}

export function mergeFruits(levelA: FruitLevel, levelB: FruitLevel, chain = 1): MergeResult | null {
  if (!isFruitLevel(levelA) || !isFruitLevel(levelB) || levelA !== levelB) return null
  if (levelA >= FRUIT_LEVELS.length - 1) return null
  const nextLevel = levelA + 1
  return {
    nextLevel,
    score: scoreForLevel(nextLevel) * Math.max(1, Math.floor(chain))
  }
}

export function randomDropLevel(random: RandomSource = Math.random): FruitLevel {
  const normalized = normalizeRandom(random())
  const index = Math.min(Math.floor(normalized * DROP_LEVELS.length), DROP_LEVELS.length - 1)
  return DROP_LEVELS[index] ?? 0
}

export function fruitAt(level: FruitLevel): typeof FRUIT_LEVELS[number] {
  if (!isFruitLevel(level)) throw new Error('无效的水果等级')
  return FRUIT_LEVELS[level] ?? FRUIT_LEVELS[0]
}

export function scoreForLevel(level: FruitLevel): number {
  if (!isFruitLevel(level)) return 0
  return Math.round(10 * 1.65 ** level)
}

function isFruitLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 0 && level < FRUIT_LEVELS.length
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 0.999999999999))
}
