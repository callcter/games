import type { SokobanState } from './core/game'

export interface SokobanVisualDelta {
  playerFrom: number
  playerTo: number
  boxIndex: number
  boxFrom: number
  boxTo: number
}

export function sokobanVisualDelta(
  previous: SokobanState,
  next: SokobanState
): SokobanVisualDelta {
  let boxIndex = -1
  let boxFrom = -1
  let boxTo = -1

  const count = Math.min(previous.boxes.length, next.boxes.length)
  for (let index = 0; index < count; index++) {
    if (previous.boxes[index] === next.boxes[index]) continue
    boxIndex = index
    boxFrom = previous.boxes[index]!
    boxTo = next.boxes[index]!
    break
  }

  return {
    playerFrom: previous.player,
    playerTo: next.player,
    boxIndex,
    boxFrom,
    boxTo
  }
}
