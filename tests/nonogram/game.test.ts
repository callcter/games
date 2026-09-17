import { expect, it } from 'vitest'
import { clues, countSolutions, legacyV2ToV3, LEGACY_V2_TO_V3, lineCells, mark, newGame, PATTERNS, solution } from '../../src/games/nonogram/core/game'
it('all picture clues have one solution', () => {
  PATTERNS.forEach((_, index) => expect(countSolutions(solution(index))).toBe(1))
  expect(clues([0, 1, 1, 0, 1])).toEqual([2, 1])
  expect(clues([0, 0])).toEqual([0])
})
it('expands to 30+ distinct pictures keeping original identities stable', () => {
  // Wave 4 内容扩展：变体去重；原图 0-8 保持旧索引（旧存档/完成记录兼容）；
  // 变体段内 5×5 变体先于 10×10 变体，形成先易后难的追加梯度。
  expect(PATTERNS.length).toBeGreaterThanOrEqual(30)
  const keys = new Set(PATTERNS.map(pattern => pattern.rows.join('/')))
  expect(keys.size).toBe(PATTERNS.length)
  const base = PATTERNS.slice(0, 9)
  expect(base.map(pattern => pattern.name)).toEqual(['小爱心', '小房子', '小树', '小十字', '小花', '大爱心', '小猫咪', '小帆船', '小火箭'])
  expect(base.map(pattern => pattern.rows[0]!.length)).toEqual([5, 5, 5, 5, 5, 10, 10, 10, 10])
  const variantSizes = PATTERNS.slice(9).map(pattern => pattern.rows[0]!.length)
  expect([...variantSizes].sort((a, b) => a - b)).toEqual(variantSizes)
})
it('maps the released interleaved numbering exactly onto the current library', () => {
  // 二轮验收 R2：已发布交错版（f352e7f..c4fb94e）编号 → 当前编号必须是精确双射，
  // 且逐项与「原图与其变体连续」的该代顺序一致（小爱心族在前）。
  expect(LEGACY_V2_TO_V3).toHaveLength(PATTERNS.length)
  expect(new Set(LEGACY_V2_TO_V3).size).toBe(LEGACY_V2_TO_V3.length)
  expect(LEGACY_V2_TO_V3[0]).toBe(0)
  // 小爱心左右对称，其「镜」变体与原图相同被去重——该代 level 1 实际是「影」。
  expect(PATTERNS[LEGACY_V2_TO_V3[1]!]!.name).toBe('小爱心·影')
  // 对称图案的重复变体被去重后，该代 level 6 是小房子（与二轮验收报告实测一致）。
  expect(PATTERNS[LEGACY_V2_TO_V3[6]!]!.name).toBe('小房子')
  expect(legacyV2ToV3(-1)).toBeUndefined()
  expect(legacyV2ToV3(PATTERNS.length)).toBeUndefined()
})
it('restores drafts from the released interleaved version via the mapping', async () => {
  const { restoreNonogram } = await import('../../src/games/puzzle-kit/core/drafts')
  // 该版 level=2 是「小爱心·斜」（转置）：与原身份的「小树」差异足够大，
  // 有真实进度的存档可以按相容度区分并正确映射。
  const mirror = PATTERNS.findIndex(pattern => pattern.name === '小爱心·斜')
  const tree = PATTERNS.findIndex(pattern => pattern.name === '小树')
  const mirrorSolution = solution(mirror)
  const treeSolution = solution(tree)
  const distinctive = mirrorSolution.flatMap((v, i) => v === 1 && treeSolution[i] !== 1 ? [i] : []).slice(0, 3)
  expect(distinctive.length).toBeGreaterThanOrEqual(2)
  const marks = Array<number>(25).fill(0)
  for (const i of distinctive) marks[i] = 1
  const draft = { state: { level: 2, marks, won: false }, history: [], assisted: false }
  const restored = restoreNonogram(draft)
  expect(restored?.state.level).toBe(mirror)
  // 不可区分对（小爱心·影与小房子仅差 1 格、进度浅）：按原身份保守恢复，
  // 原档由场景进入时的一次性备份保护（无版本号数据的固有限制，策略见 scene）。
  const ambiguous = { state: { level: 1, marks: Array<number>(25).fill(0), won: false }, history: [], assisted: false }
  expect(restoreNonogram(ambiguous)?.state.level).toBe(1)
  expect(restored?.state.marks).toHaveLength(25)
  // 该版 level=6 是「小房子」（当前是 1，同为 25 格）：同尺寸错配必须靠映射纠正。
  const houseDraft = { state: { level: 6, marks: Array<number>(25).fill(0), won: false }, history: [], assisted: false }
  expect(PATTERNS[restoreNonogram(houseDraft)!.state.level]!.name).toBe('小房子')
  // ≥9 的 10×10 档同样可恢复。
  const v2Big = LEGACY_V2_TO_V3.findIndex((v3, v2) => PATTERNS[v3]!.rows[0]!.length === 10 && v2 >= 9)
  expect(restoreNonogram({ state: { level: v2Big, marks: Array<number>(100).fill(0), won: false }, history: [], assisted: false })?.state.marks).toHaveLength(100)
  // 空进度档按原身份优先（level<9 时两代同数字，原图身份不迁移）。
  const blank = restoreNonogram({ state: { level: 1, marks: Array<number>(25).fill(0), won: false }, history: [], assisted: false })
  expect(blank?.state.level).toBe(1)
})
it('rejects drafts that match no generation', async () => {
  const { restoreNonogram } = await import('../../src/games/puzzle-kit/core/drafts')
  // 与两代候选图案都严重不符（已填格几乎不在任一目标内）→ 视为损坏。
  const marks = Array<number>(100).fill(0)
  marks[0] = 1; marks[1] = 1; marks[2] = 1; marks[3] = 1; marks[4] = 1
  expect(restoreNonogram({ state: { level: 6, marks, won: false }, history: [], assisted: false })).toBeNull()
  expect(restoreNonogram({ state: { level: 999, marks: Array<number>(25).fill(0), won: false }, history: [], assisted: false })).toBeNull()
})
it('restores pre-expansion drafts at their original picture identity', async () => {
  // 扩容前的真实存档（v1 键、level=5 是 10×10 大爱心）必须原样恢复。
  const { restoreNonogram } = await import('../../src/games/puzzle-kit/core/drafts')
  const legacy = { state: { level: 5, marks: Array<number>(100).fill(0), won: false }, history: [], assisted: false }
  const restored = restoreNonogram(legacy)
  expect(restored?.state.level).toBe(5)
  expect(restored?.state.marks).toHaveLength(100)
  expect(PATTERNS[5]!.name).toBe('大爱心')
  expect(solution(5)).toHaveLength(100)
  const legacy8 = { state: { level: 8, marks: Array<number>(100).fill(0), won: false }, history: [], assisted: false }
  expect(restoreNonogram(legacy8)?.state.level).toBe(8)
  // R2 修正：level=5 + 25 格不再是损坏数据——它是已发布交错版的合法存档（该代
  // level 5 是小爱心族变体 5×5），按映射恢复而非拒绝。
  const interleaved = { state: { level: 5, marks: Array<number>(25).fill(0), won: false }, history: [], assisted: false }
  const mapped = restoreNonogram(interleaved)
  expect(mapped?.state.marks).toHaveLength(25)
  expect(mapped?.state.level).toBe(LEGACY_V2_TO_V3[5]!)
})
it('fills skipped cells during a stroke in either direction without wrapping rows', () => {
  expect(lineCells(0, 4, 5)).toEqual([0,1,2,3,4])
  expect(lineCells(24, 4, 5)).toEqual([24,19,14,9,4])
  expect(lineCells(0, 24, 5)).toEqual([0,6,12,18,24])
  expect(lineCells(-1, 4, 5)).toEqual([])
  const state = newGame()
  expect(mark(state, 0, 0)).toBe(state)
})
it('supports the 10x10 challenge patterns', () => {
  const level = PATTERNS.findIndex(pattern => pattern.rows[0]!.length === 10)
  expect(level).toBeGreaterThanOrEqual(0)
  expect(solution(level)).toHaveLength(100)
  expect(newGame(level).marks).toHaveLength(100)
  expect(mark(newGame(level), 99, 1).marks[99]).toBe(1)
  expect(mark(newGame(level), 100, 1).won).toBe(false)
  expect(() => solution(PATTERNS.length)).toThrow('无效关卡')
  let state = newGame(level)
  solution(level).forEach((value, index) => { state = mark(state, index, value ? 1 : -1) })
  expect(state.won).toBe(true)
})
it('requires exactly the correct filled squares and ignores empty crosses', () => {
  const initial = newGame()
  expect(mark(initial, -1, 1)).toBe(initial)
  let state = initial
  solution(0).forEach((value, index) => { state = mark(state, index, value ? 1 : -1) })
  expect(state.won).toBe(true)
  expect(mark(state, 0, 1)).toBe(state)
  expect(initial.marks.every(value => value === 0)).toBe(true)
})
