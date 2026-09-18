import { type RandomSource } from '../../cards/core/cards'

// 叠叠消：多层错位叠放的方块，点选可见的进 7 格槽，三同消除，全部消完获胜。
// 槽满不清盘——提供有限次免费撤销与洗牌（儿童产品失败零惩罚）。
// 规则层无 Phaser/DOM 依赖，随机由注入源提供。

export const SLOT_SIZE = 7

export interface Tile {
  id: number
  kind: number
  layer: number
  gx: number
  gy: number
}

export interface MatchState {
  tiles: Tile[] // 全量方块（含已离场），离场与否看 gone/slot
  gone: number[] // 已离场（在槽或已消除）的 tile id
  slot: number[] // 槽内待配对 tile id（最多 7）
  cleared: number // 已消除组数
  undoLog: { picked: number; cleared: number[] }[]
  undos: number
  shuffles: number
  won: boolean
}

export interface MatchMode {
  label: string
  kinds: number
  tiles: number
  layers: number
  layerCounts: readonly number[]
  interleave: 1 | 3 | 5
}

export const MODES: readonly MatchMode[] = [
  // 基础：三同款沿保证可解的顺序连续出现，便于儿童理解规则。
  { label: '基础', kinds: 6, tiles: 27, layers: 3, layerCounts: [12, 9, 6], interleave: 1 },
  // 进阶：三个花色交错，但保证解题路径中槽位最多占 5 格。
  { label: '进阶', kinds: 8, tiles: 39, layers: 5, layerCounts: [12, 9, 6, 6, 6], interleave: 3 },
  // 挑战：三个花色更深交错，保证解题路径中槽位最多占 6 格，不会靠 fallback 退化为平铺。
  { label: '挑战', kinds: 10, tiles: 48, layers: 6, layerCounts: [12, 9, 9, 6, 6, 6], interleave: 5 }
]

const kindOf = (state: MatchState, id: number): number => state.tiles.find(tile => tile.id === id)!.kind

/**
 * v3 的几何坐标已经在 buildSlots() 中居中并错位，因此规则层与表现层都直接使用 gx/gy。
 * 不再额外叠加 layer * 0.34；旧算法在 6 层挑战局会累计平移超过 2 格，造成塔体斜飘。
 */
function blocked(tiles: readonly Tile[], gone: ReadonlySet<number>, tile: Tile): boolean {
  return tiles.some(other =>
    other.id !== tile.id
    && !gone.has(other.id)
    && other.layer > tile.layer
    && Math.abs(other.gx - tile.gx) < 0.92
    && Math.abs(other.gy - tile.gy) < 0.92
  )
}

/** 当前可点选（未被压住且未离场）的方块 id。 */
export function pickable(state: MatchState): number[] {
  const gone = new Set(state.gone)
  return state.tiles
    .filter(tile => !gone.has(tile.id) && !blocked(state.tiles, gone, tile))
    .map(tile => tile.id)
}

export function isStuck(state: MatchState): boolean {
  return !state.won && state.slot.length >= SLOT_SIZE
}

/** 点选一个方块进槽；同款凑满三个立即消除。非法返回 null 且不改状态。 */
export function pick(state: MatchState, tileId: number): { state: MatchState; cleared: number[] } | null {
  if (state.won || state.slot.length >= SLOT_SIZE) return null
  if (!pickable(state).includes(tileId)) return null

  const kind = kindOf(state, tileId)
  let slot = [...state.slot, tileId]
  const cleared: number[] = []

  if (slot.filter(id => kindOf(state, id) === kind).length >= 3) {
    for (const id of slot) {
      if (kindOf(state, id) === kind) cleared.push(id)
    }
    slot = slot.filter(id => !cleared.includes(id))
  }

  const gone = [...new Set([...state.gone, tileId, ...cleared])]
  return {
    state: {
      ...state,
      slot,
      gone,
      cleared: state.cleared + (cleared.length ? 1 : 0),
      undoLog: [...state.undoLog.slice(-99), { picked: tileId, cleared }],
      won: gone.length === state.tiles.length && slot.length === 0
    },
    cleared
  }
}

/** 撤销最近一次拾取（若那次触发消除，三张一起回场）。 */
export function undo(state: MatchState): MatchState | null {
  if (state.won || !state.undoLog.length || state.undos <= 0) return null

  const log = [...state.undoLog]
  const last = log.pop()!
  const slot = state.slot.filter(id => id !== last.picked)
  const gone = state.gone.filter(id => id !== last.picked && !last.cleared.includes(id))

  return {
    ...state,
    slot,
    gone,
    undoLog: log,
    undos: state.undos - 1,
    cleared: state.cleared - (last.cleared.length ? 1 : 0)
  }
}

function shuffleInPlace<T>(values: T[], random: RandomSource): void {
  for (let index = values.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[values[index], values[swap]] = [values[swap]!, values[index]!]
  }
}

/**
 * 每层使用居中网格：
 * - 12 张：4×3；
 * - 9 张：3×3；
 * - 6 张：3×2。
 *
 * 每层只做 ±0.16 格的轻微交替错位；叠放关系由真实 gx/gy 决定，
 * 所以 5/6 层不会像旧版那样累计斜移到另外两格之外。
 */
function buildSlots(config: MatchMode): { layer: number; gx: number; gy: number }[] {
  const slots: { layer: number; gx: number; gy: number }[] = []

  config.layerCounts.forEach((count, layer) => {
    const columns = count >= 10 ? 4 : 3
    const rows = Math.ceil(count / columns)
    const shift = ((layer % 3) - 1) * 0.16

    for (let index = 0; index < count; index++) {
      const column = index % columns
      const row = Math.floor(index / columns)
      slots.push({
        layer,
        gx: column - (columns - 1) / 2 + shift,
        gy: row - (rows - 1) / 2 - shift * 0.6
      })
    }
  })

  // 配置错误要显式暴露，不能静默截断后再生成“看起来能玩”的坏局。
  if (slots.length !== config.tiles || config.layerCounts.length !== config.layers) {
    throw new Error(`Invalid tile-match mode layout: expected ${config.tiles}/${config.layers}, got ${slots.length}/${config.layerCounts.length}`)
  }

  return slots
}

/**
 * 仅依赖遮挡几何生成一个合法“从上往下拿”的顺序。
 * 每一步都从当时真实可拿的牌里随机选一张，因此顺序本身就是合法拓扑序。
 */
function buildRemovalOrder(
  tiles: readonly Tile[],
  initialGone: ReadonlySet<number>,
  random: RandomSource
): number[] {
  const gone = new Set(initialGone)
  const order: number[] = []

  while (gone.size < tiles.length) {
    const free = tiles
      .filter(tile => !gone.has(tile.id) && !blocked(tiles, gone, tile))
      .map(tile => tile.id)

    if (!free.length) {
      // blocked() 只依赖更高层，本应形成 DAG；如果触达这里说明几何规则被改坏。
      throw new Error('Tile-match layout has no removable tile')
    }

    const id = free[Math.floor(random() * free.length)]!
    gone.add(id)
    order.push(id)
  }

  return order
}

function makeGroupKinds(groups: number, kinds: number, random: RandomSource): number[] {
  const result: number[] = []
  while (result.length < groups) {
    const cycle = Array.from({ length: kinds }, (_, index) => index)
    shuffleInPlace(cycle, random)
    result.push(...cycle)
  }
  return result.slice(0, groups)
}

/**
 * 把“每组三张”的花色映射到一个已知合法的移除顺序。
 *
 * interleave:
 * - 1（基础）：AAA BBB CCC
 * - 3（进阶）：A B A C B A C B C，解题路径槽位峰值 5
 * - 5（挑战）：A B C A B C A B C，解题路径槽位峰值 6
 *
 * 因为每 9 个位置仍然恰好是 A/B/C 各三张，所以总数与花色计数保持三的倍数；
 * 同时不再依赖“随机 40 次 + simSolves + 单层 fallback”。
 */
function buildKindSequence(
  groupKinds: readonly number[],
  interleave: MatchMode['interleave']
): number[] {
  const result: number[] = []

  if (interleave === 1) {
    for (const kind of groupKinds) result.push(kind, kind, kind)
    return result
  }

  for (let index = 0; index < groupKinds.length; index += 3) {
    const chunk = groupKinds.slice(index, index + 3)

    if (chunk.length === 3) {
      const [a, b, c] = chunk as [number, number, number]
      if (interleave === 3) {
        result.push(a, b, a, c, b, a, c, b, c)
      } else {
        result.push(a, b, c, a, b, c, a, b, c)
      }
    } else if (chunk.length === 2) {
      const [a, b] = chunk as [number, number]
      result.push(a, b, a, b, a, b)
    } else if (chunk.length === 1) {
      const [a] = chunk as [number]
      result.push(a, a, a)
    }
  }

  return result
}

function assignKindsByRemovalOrder(
  tiles: readonly Tile[],
  order: readonly number[],
  groupKinds: readonly number[],
  interleave: MatchMode['interleave']
): Tile[] {
  const sequence = buildKindSequence(groupKinds, interleave)

  if (sequence.length !== order.length) {
    throw new Error(`Invalid tile-match kind sequence: ${sequence.length} for ${order.length} tiles`)
  }

  const kindById = new Map<number, number>()
  order.forEach((id, index) => kindById.set(id, sequence[index]!))
  return tiles.map(tile => ({ ...tile, kind: kindById.get(tile.id) ?? tile.kind }))
}

/**
 * 槽中未消除的牌先回场，再对所有剩余牌重新分配花色。
 *
 * v2 使用“随机 24 次 + simSolves”可能在复杂局直接返回 null；
 * v3 利用剩余牌的几何拓扑构造保证可解的重新分配，因此洗牌本身是可靠的救援操作。
 */
export function shuffle(state: MatchState, random: RandomSource = Math.random): MatchState | null {
  if (state.won || state.shuffles <= 0) return null

  const clearedGone = new Set(state.gone.filter(id => !state.slot.includes(id)))
  const rest = state.tiles.filter(tile => !clearedGone.has(tile.id))
  if (!rest.length || rest.length % 3 !== 0) return null

  const countByKind = new Map<number, number>()
  for (const tile of rest) {
    countByKind.set(tile.kind, (countByKind.get(tile.kind) ?? 0) + 1)
  }

  const groupKinds: number[] = []
  for (const [kind, count] of countByKind) {
    if (count % 3 !== 0) return null
    for (let group = 0; group < count / 3; group++) groupKinds.push(kind)
  }
  shuffleInPlace(groupKinds, random)

  const order = buildRemovalOrder(state.tiles, clearedGone, random)
  const restOrder = order.filter(id => !clearedGone.has(id))
  const reassigned = assignKindsByRemovalOrder(state.tiles, restOrder, groupKinds, 1)

  return {
    ...state,
    tiles: reassigned,
    gone: [...clearedGone],
    slot: [],
    shuffles: state.shuffles - 1,
    undoLog: []
  }
}

/**
 * 保留旧的贪心模拟作为诊断工具和现有测试兼容层。
 * 生成器已不再把它当作“可解性的唯一证明”，因为贪心失败不等于局面无解。
 */
export function simSolves(state: MatchState): boolean {
  const gone = [...state.gone]
  let slot = [...state.slot]

  for (let guard = 0; guard < 600; guard++) {
    if (slot.length >= SLOT_SIZE) return false

    const taken = new Set(gone)
    const free = state.tiles.filter(tile => !taken.has(tile.id) && !blocked(state.tiles, taken, tile))
    if (!free.length) return slot.length === 0 && gone.length === state.tiles.length

    const slotCount = new Map<number, number>()
    slot.forEach(id => slotCount.set(kindOf(state, id), (slotCount.get(kindOf(state, id)) ?? 0) + 1))

    const freeCount = new Map<number, number>()
    free.forEach(tile => freeCount.set(tile.kind, (freeCount.get(tile.kind) ?? 0) + 1))

    let choice: Tile | null = null
    let bestScore = -1

    for (const tile of free) {
      const inSlot = slotCount.get(tile.kind) ?? 0
      const score = inSlot >= 2
        ? 3
        : inSlot === 1 && (freeCount.get(tile.kind) ?? 0) >= 2
          ? 2
          : inSlot === 0
            ? 1
            : -1

      if (score > bestScore) {
        bestScore = score
        choice = tile
      }
    }

    if (!choice || bestScore < 0) return false

    slot = [...slot, choice.id]
    gone.push(choice.id)
    const selectedKind = choice.kind
    if (slot.filter(id => kindOf(state, id) === selectedKind).length >= 3) {
      slot = slot.filter(id => kindOf(state, id) !== selectedKind)
    }

    if (slot.length > SLOT_SIZE) return false
    if (gone.length === state.tiles.length) return slot.length === 0
  }

  return false
}

/**
 * 构造式生成：
 * 1. 先生成真正的多层几何；
 * 2. 从几何得到一条合法移除拓扑序；
 * 3. 按难度把花色映射到这条路径上。
 *
 * 因此基础/进阶/挑战都“生来可解”，不存在旧版 40 次随机失败后退化成
 * 6 列单层平铺的情况。随机源再极端也只改变移除顺序/花色分布，不改变可解性。
 */
export function newMatch(mode: number, random: RandomSource = Math.random): MatchState {
  const config = MODES[mode] ?? MODES[0]!
  const slots = buildSlots(config)

  const geometry: Tile[] = slots.map((slot, id) => ({
    id,
    kind: 0,
    layer: slot.layer,
    gx: slot.gx,
    gy: slot.gy
  }))

  const order = buildRemovalOrder(geometry, new Set<number>(), random)
  const groupKinds = makeGroupKinds(config.tiles / 3, config.kinds, random)
  const tiles = assignKindsByRemovalOrder(geometry, order, groupKinds, config.interleave)

  return {
    tiles,
    gone: [],
    slot: [],
    cleared: 0,
    undoLog: [],
    undos: 5,
    shuffles: 1,
    won: false
  }
}
