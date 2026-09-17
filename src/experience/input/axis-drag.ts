import Phaser from 'phaser'
import { blockedDirection, clampWithRubberBand, dragExtent, nearestStop, shouldCommitStop, type DragStop } from './axis-drag-core'

export type { DragStop } from './axis-drag-core'
export { blockedDirection, clampWithRubberBand, dragExtent, nearestStop, shouldCommitStop } from './axis-drag-core'

export interface AxisDragConfig {
  axis: 'x' | 'y'
  /** 拖动开始时获取当前合法停靠点（拖动期间缓存，不重复求值）。 */
  getStops: () => readonly DragStop[]
  /** 拖动开始时是否响应（例如已有别的车在被拖时锁住）；返回 false 时整个会话被忽略。 */
  isEnabled?: () => boolean
  onPickup?: (stop: DragStop | null) => void
  /** 每次移动只更新表现层，不允许写 core/存档（方案 §54.1）。 */
  onMove?: (position: number) => void
  /** 手指顶到合法边界（每个方向只报一次）。 */
  onBlocked?: (direction: -1 | 1) => void
  /** 松手：吸附最近合法格，由调用方提交 core。 */
  onCommit: (stop: DragStop) => void
  /** 原地松手 / 无位移：调用方负责回弹。 */
  onCancel?: () => void
  /** 橡皮筋超出量，默认 8px。 */
  rubberBand?: number
}

type DragTarget = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform

/**
 * 轴向拖动控制器：包装 Phaser 内置 drag 系统（指针捕获、单活跃拖动由输入插件保证）。
 * 只在 dragstart/drag/dragend 三个输入插件事件上工作，Scene SHUTDOWN/DESTROY 时输入插件
 * 自行解绑，另挂 SHUTDOWN 兜底销毁，重复调用 destroy 幂等。
 */
export class AxisDragController {
  private readonly scene: Phaser.Scene
  private readonly target: DragTarget
  private readonly config: AxisDragConfig
  private readonly handlers: Array<[string, (pointer: Phaser.Input.Pointer, object?: unknown, dragX?: number, dragY?: number) => void]>
  private stops: readonly DragStop[] = []
  private extent: { min: number; max: number } | null = null
  private active = false
  private startPixel = 0
  private lastBlocked: -1 | 0 | 1 = 0
  private destroyed = false

  constructor(scene: Phaser.Scene, target: DragTarget, config: AxisDragConfig) {
    this.scene = scene
    this.target = target
    this.config = config
    this.handlers = [
      ['dragstart', (_pointer, object) => { if (object === target) this.begin() }],
      ['drag', (_pointer, object, dragX, dragY) => { if (object === target && this.active) this.move((config.axis === 'x' ? dragX : dragY) ?? 0) }],
      ['dragend', (_pointer, object) => { if (object === target && this.active) this.end() }]
    ]
    for (const [event, handler] of this.handlers) scene.input.on(event as never, handler as never)
    scene.input.setDraggable(target)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy())
  }

  private position(): number {
    return this.config.axis === 'x' ? this.target.x : this.target.y
  }

  private begin(): void {
    if (this.destroyed || (this.config.isEnabled && !this.config.isEnabled())) return
    this.active = true
    this.lastBlocked = 0
    this.stops = this.config.getStops()
    this.extent = dragExtent(this.stops)
    // 合法停靠点不含当前位置（原地不是移动目标），但可拖包络必须覆盖当前位置，
    // 否则静止的指针会被橡皮筋钳制拉向停靠点、把「没拖动」误判成移动。
    if (this.extent) {
      const current = this.position()
      this.extent = { min: Math.min(this.extent.min, current), max: Math.max(this.extent.max, current) }
    }
    this.startPixel = this.position()
    this.config.onPickup?.(this.stops.length ? nearestStop(this.startPixel, this.stops) : null)
  }

  private move(raw: number): void {
    if (!this.extent) return
    const { min, max } = this.extent
    const position = clampWithRubberBand(raw, min, max, this.config.rubberBand ?? 8)
    const direction = blockedDirection(raw, min, max)
    if (direction !== 0 && direction !== this.lastBlocked) this.config.onBlocked?.(direction)
    this.lastBlocked = direction
    if (this.config.axis === 'x') this.target.x = position
    else this.target.y = position
    this.config.onMove?.(position)
  }

  private end(): void {
    this.active = false
    const stop = shouldCommitStop(this.position(), this.startPixel, this.stops)
    if (stop) {
      this.config.onCommit(stop)
    } else {
      this.config.onCancel?.()
    }
  }

  /** 幂等销毁：解绑输入事件并撤销 draggable 标记。 */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    for (const [event, handler] of this.handlers) this.scene.input.off(event as never, handler as never)
    this.scene.input.setDraggable(this.target, false)
    this.handlers.length = 0
  }
}
