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

export const MODES: readonly { label: string; kinds: number; tiles: number; layers: number }[] = [
  { label: '基础', kinds: 6, tiles: 27, layers: 3 },
  { label: '进阶', kinds: 8, tiles: 39, layers: 5 },
  { label: '挑战', kinds: 10, tiles: 48, layers: 6 }
]

const kindOf = (state: MatchState, id: number): number => state.tiles.find(tile => tile.id === id)!.kind

/** 世界坐标：层越高越向右上偏移，模拟斜向叠放。 */
const worldX = (tile: Tile): number => tile.gx + tile.layer * 0.34
const worldY = (tile: Tile): number => tile.gy + tile.layer * 0.34

function blocked(tiles: readonly Tile[], gone: ReadonlySet<number>, tile: Tile): boolean {
  return tiles.some(other => other.id !== tile.id && !gone.has(other.id) && other.layer > tile.layer
    && Math.abs(worldX(other) - worldX(tile)) < 0.99 && Math.abs(worldY(other) - worldY(tile)) < 0.99)
}

/** 当前可点选（未被压住且未离场）的方块 id。 */
export function pickable(state: MatchState): number[] {
  const gone = new Set(state.gone)
  return state.tiles.filter(tile => !gone.has(tile.id) && !blocked(state.tiles, gone, tile)).map(tile => tile.id)
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
    for (const id of slot) if (kindOf(state, id) === kind) cleared.push(id)
    slot = slot.filter(id => !cleared.includes(id))
  }
  const gone = [...new Set([...state.gone, tileId, ...cleared])]
  return {
    state: {
      ...state, slot, gone,
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
    ...state, slot, gone, undoLog: log, undos: state.undos - 1,
    cleared: state.cleared - (last.cleared.length ? 1 : 0)
  }
}

/** 剩余方块重新随机花色（位置与遮挡不变）；要求洗后仍可解，失败返回 null。 */
export function shuffle(state: MatchState, random: RandomSource = Math.random): MatchState | null {
  if (state.won || state.shuffles <= 0) return null
  const gone = new Set(state.gone)
  const rest = state.tiles.filter(tile => !gone.has(tile.id))
  if (!rest.length) return null
  for (let attempt = 0; attempt < 24; attempt++) {
    const kinds = rest.map(tile => tile.kind)
    for (let index = kinds.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1))
      ;[kinds[index], kinds[swap]] = [kinds[swap]!, kinds[index]!]
    }
    const tiles = state.tiles.map(tile => {
      const at = rest.indexOf(tile)
      return at >= 0 ? { ...tile, kind: kinds[at]! } : tile
    })
    const candidate: MatchState = { ...state, tiles, shuffles: state.shuffles - 1, undoLog: [] }
    if (simSolves(candidate)) return candidate
  }
  return null
}

/** 贪心模拟验证整局可清空（供生成与洗牌复核）：
 * 拾取优先级——能立即凑三 > 槽内已有且场上还有第三张 > 全新花色；
 * 绝不把「场上再无第三张」的花色第二张拾进槽（避免死对占位）。 */
export function simSolves(state: MatchState): boolean {
  const gone = [...state.gone]
  let slot = [...state.slot]
  for (let guard = 0; guard < 600; guard++) {
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
      const score = inSlot >= 2 ? 3 : inSlot === 1 && (freeCount.get(tile.kind) ?? 0) >= 2 ? 2 : inSlot === 0 ? 1 : -1
      if (score > bestScore) { bestScore = score; choice = tile }
    }
    if (!choice || bestScore < 0) return false // 只剩会形成死对的选择
    slot = [...slot, choice.id]
    gone.push(choice.id)
    slot = slot.filter(id => kindOf(state, id) !== choice.kind || slot.filter(inner => kindOf(state, inner) === kindOf(state, id)).length < 3)
    if (slot.length > SLOT_SIZE) return false
    if (gone.length === state.tiles.length) return slot.length === 0
  }
  return false
}

/** 展开模板：每层近似方形排布，奇数层横向错半格制造遮挡。 */
function buildSlots(count: number, layers: number): { layer: number; gx: number; gy: number }[] {
  const slots: { layer: number; gx: number; gy: number }[] = []
  const per = Math.floor(count / layers)
  for (let layer = 0; layer < layers; layer++) {
    const size = layer === layers - 1 ? count - per * (layers - 1) : per
    const side = Math.ceil(Math.sqrt(size))
    const columns = Math.ceil(size / side)
    for (let index = 0; index < size; index++) {
      slots.push({ layer, gx: (index % columns) + (layer % 2) * 0.5, gy: Math.floor(index / columns) })
    }
  }
  return slots
}

/**
 * 生成：花色三个一组随机洗开，铺进「深层优先」的模板槽位；生成后贪心模拟
 * 验证可解，不合格换一轮。初始槽为空、给 5 次撤销与 1 次洗牌。
 */
export function newMatch(mode: number, random: RandomSource = Math.random): MatchState {
  const config = MODES[mode] ?? MODES[0]!
  const slots = buildSlots(config.tiles, config.layers)
  const groups = Math.floor(slots.length / 3)
  const ordered = [...slots.slice(0, groups * 3)].sort((a, b) => b.layer - a.layer)
  for (let attempt = 0; attempt < 40; attempt++) {
    const kinds: number[] = []
    for (let group = 0; group < groups; group++) {
      const kind = group % config.kinds
      kinds.push(kind, kind, kind) // 每组三张同款，总数恰为 3 的倍数
    }
    for (let index = kinds.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1))
      ;[kinds[index], kinds[swap]] = [kinds[swap]!, kinds[index]!]
    }
    const tiles: Tile[] = ordered.map((slot, index) => ({ id: index, kind: kinds[index]!, layer: slot.layer, gx: slot.gx, gy: slot.gy }))
    const state: MatchState = { tiles, gone: [], slot: [], cleared: 0, undoLog: [], undos: 5, shuffles: 1, won: false }
    if (simSolves(state)) return state
  }
  // 兜底：单层无遮挡平铺（必然可解，仅极端随机流触达）。
  const flat: Tile[] = Array.from({ length: groups * 3 }, (_, index) => ({ id: index, kind: Math.floor(index / 3) % config.kinds, layer: 0, gx: index % 6, gy: Math.floor(index / 6) }))
  return { tiles: flat, gone: [], slot: [], cleared: 0, undoLog: [], undos: 5, shuffles: 1, won: false }
}
