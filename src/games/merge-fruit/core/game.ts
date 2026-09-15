export const FRUIT_LEVELS = [
  { name: '樱桃', color: 0xe95c62, accent: 0xff8990, radius: 18 },
  { name: '草莓', color: 0xf06b78, accent: 0xffa0a8, radius: 24 },
  { name: '葡萄', color: 0x9c72c8, accent: 0xc6a1e6, radius: 31 },
  { name: '橘子', color: 0xf39a48, accent: 0xffc06d, radius: 40 },
  { name: '柠檬', color: 0xe7cd4d, accent: 0xffe978, radius: 51 },
  { name: '苹果', color: 0xd85e54, accent: 0xf48a75, radius: 65 },
  { name: '桃子', color: 0xef9c8e, accent: 0xffc0aa, radius: 82 },
  { name: '椰子', color: 0x9b6d4d, accent: 0xc6966c, radius: 104 },
  { name: '菠萝', color: 0xd8a93d, accent: 0xf2cf62, radius: 128 },
  { name: '哈密瓜', color: 0x91b85c, accent: 0xbad67b, radius: 154 },
  { name: '大西瓜', color: 0x4f9d65, accent: 0x79c985, radius: 185 }
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

