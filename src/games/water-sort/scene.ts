import Phaser from 'phaser'
import { attachFirstRunHelp, showHelpPanel } from '../../ui/phaser/help'
import type { GameAudio } from '../../platform/audio/game-audio'
import { releaseHostBackdrop, setHostBackdrop } from '../../platform/display/host-backdrop'
import { flushDraft, loadDraft, saveDraft } from '../puzzle-kit/draft-storage'
import { restoreWaterSort, type WaterSortDraft } from '../puzzle-kit/core/drafts'
import { recordFlag } from '../puzzle-kit/progress'
import {
  canPour,
  completedCount,
  isTubeComplete,
  MODES,
  newGame,
  pour,
  solvePath,
  type WaterState
} from './core/game'
import { preloadWaterSortArt, WATER_BG_KEY, WATER_SFX } from './art'
import {
  createModePill,
  createStatChip,
  createToolButton,
  WATER_UI,
  type ModePill,
  type StatChip,
  type ToolButton
} from './cozy-ui'
import { createPuzzleChrome, preloadGameUi } from '../../ui'

const DESIGN_WIDTH = 768
const FONT = 'Avenir Next, PingFang SC, sans-serif'

const TUBE_W = 88
const TUBE_H = 238
const INNER_W = 68
const LAYER_H = 44
const INNER_BOTTOM = 96

const PALETTE = [0xef705c, 0x50aa91, 0xe9b83e, 0x6f88d8, 0xbb78c8, 0x3ea8d0]
const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚']

interface Layout {
  height: number
  topY: number
  statsY: number
  boardTop: number
  boardBottom: number
  toolY: number
}

interface TubePosition {
  x: number
  y: number
  scale: number
}

interface TubeView {
  index: number
  container: Phaser.GameObjects.Container
  shadow: Phaser.GameObjects.Graphics
  liquid: Phaser.GameObjects.Graphics
  symbols: Phaser.GameObjects.Container
  glass: Phaser.GameObjects.Graphics
  badge: Phaser.GameObjects.Container
  homeX: number
  homeY: number
  baseScale: number
  complete: boolean
}

export class WaterSortScene extends Phaser.Scene {
  private readonly audio: GameAudio
  private readonly exitGame: () => void

  private mode = 0
  private state: WaterState = { tubes: [], colors: 0, moves: 0, won: false }
  private history: WaterState[] = []
  private selected = -1
  private busy = true
  private alive = false

  private layout!: Layout
  private background?: Phaser.GameObjects.Image
  private veil?: Phaser.GameObjects.Rectangle
  private readonly tubeViews = new Map<number, TubeView>()

  private chrome: import('../../ui').PuzzleChrome | null = null
  private modeButton!: ModePill
  private movesChip!: StatChip
  private doneChip!: StatChip
  private undoButton!: ToolButton
  private hintButton!: ToolButton
  private newButton!: ToolButton

  private toast?: Phaser.GameObjects.Container
  private overlay?: Phaser.GameObjects.Container

  constructor(audio: GameAudio, exit: () => void) {
    super('water-sort')
    this.audio = audio
    this.exitGame = exit
  }

  preload(): void {
    preloadWaterSortArt(this)
    preloadGameUi(this)
  }

  create(): void {
    this.alive = true
    this.cameras.main.setBackgroundColor('#c58b52')

    if (this.textures.exists(WATER_BG_KEY)) {
      this.background = this.add.image(0, 0, WATER_BG_KEY).setOrigin(0.5).setDepth(-30)
      setHostBackdrop('art/water-sort-bg.jpg')
    }
    this.veil = this.add.rectangle(0, 0, 1, 1, 0x5a3c25, 0.055).setOrigin(0).setDepth(-20)

    this.input.on('pointerdown', () => void this.audio.unlock())
    attachFirstRunHelp(this, '水排序')
    this.createChrome()
    this.layoutScene()

    const flush = (): void => flushDraft('water-sort')
    const visibility = (): void => {
      if (document.hidden) flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', visibility)

    const cleanup = (): void => {
      if (!this.alive) return
      this.alive = false
      flush()
      releaseHostBackdrop()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', visibility)
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    void this.initialize()
  }

  private async initialize(): Promise<void> {
    this.showToast('正在读取进度…', 0)
    const saved = await loadDraft('water-sort', restoreWaterSort)
    if (!this.alive) return
    this.hideToast()

    if (saved && !saved.state.won) {
      this.mode = saved.mode
      this.modeButton.setLabel(MODES[this.mode]?.label ?? '基础')
      this.showResumeOverlay(saved)
      return
    }

    this.startFresh(saved?.mode ?? this.mode)
  }

  private createChrome(): void {
    // 全站统一顶栏；难度 pill 与统计 chips 组成状态行（layoutScene 定位）。
    this.chrome = createPuzzleChrome(this, {
      title: '水排序',
      audio: this.audio,
      onBack: () => {
        if (this.busy) return
        this.playLocal(WATER_SFX.ui, 0.22)
        this.exitGame()
      },
      onHelp: () => {
        if (this.busy) return
        this.playLocal(WATER_SFX.ui, 0.20)
        showHelpPanel(this, '水排序')
      }
    })
    this.chrome.setStatus('')
    this.chrome.layout(DESIGN_WIDTH, this.scale.height)

    this.modeButton = createModePill(this, MODES[this.mode]?.label ?? '基础', () => {
      if (this.busy) return
      this.playLocal(WATER_SFX.ui, 0.22)
      this.mode = (this.mode + 1) % MODES.length
      this.modeButton.setLabel(MODES[this.mode]?.label ?? '基础')
      this.startFresh(this.mode)
    })

    this.movesChip = createStatChip(this, '0 步')
    this.doneChip = createStatChip(this, '完成 0/0')

    this.undoButton = createToolButton(this, 'undo', '撤销', () => this.undoMove())
    this.hintButton = createToolButton(this, 'hint', '提示', () => this.showHint())
    this.newButton = createToolButton(this, 'new', '换一局', () => this.newRound())
  }

  private handleResize(): void {
    this.layoutScene()
    if (!this.busy && this.state.tubes.length) this.reflowTubes()
  }

  private currentLayout(): Layout {
    const height = this.scale.height
    const topY = height >= 1180 ? 90 : 70
    const statsY = topY + 66
    const toolY = height - Phaser.Math.Clamp(height * 0.062, 74, 104)
    const boardTop = statsY + 50
    const boardBottom = toolY - 110
    return { height, topY, statsY, boardTop, boardBottom, toolY }
  }

  private layoutScene(): void {
    this.layout = this.currentLayout()
    const { height, statsY, toolY } = this.layout

    if (this.background) {
      const source = this.textures.get(WATER_BG_KEY).source[0]
      if (source) {
        const cover = Math.max(DESIGN_WIDTH / source.width, height / source.height)
        this.background
          .setPosition(DESIGN_WIDTH / 2, height / 2)
          .setDisplaySize(source.width * cover, source.height * cover)
      }
    }
    this.veil?.setSize(DESIGN_WIDTH, height)

    this.chrome?.layout(DESIGN_WIDTH, height)
    this.modeButton?.setPosition(DESIGN_WIDTH / 2, statsY)

    this.movesChip?.setPosition(DESIGN_WIDTH / 2 - 160, statsY)
    this.doneChip?.setPosition(DESIGN_WIDTH / 2 + 160, statsY)

    this.undoButton?.setPosition(DESIGN_WIDTH / 2 - 162, toolY)
    this.hintButton?.setPosition(DESIGN_WIDTH / 2, toolY)
    this.newButton?.setPosition(DESIGN_WIDTH / 2 + 162, toolY)
  }

  private startFresh(mode: number): void {
    this.mode = MODES[mode] ? mode : 0
    this.modeButton.setLabel(MODES[this.mode]?.label ?? '基础')
    this.state = newGame(this.mode)
    this.history = []
    this.selected = -1
    this.busy = false
    this.hideOverlay()
    this.rebuildTubes(true)
    this.save()
  }

  private newRound(): void {
    if (this.busy) return
    this.playLocal(WATER_SFX.ui, 0.22)
    this.state = newGame(this.mode)
    this.history = []
    this.selected = -1
    this.rebuildTubes(true)
    this.save()
  }

  private resume(saved: WaterSortDraft): void {
    this.mode = saved.mode
    this.state = saved.state
    this.history = [...saved.history]
    this.selected = -1
    this.busy = false
    this.modeButton.setLabel(MODES[this.mode]?.label ?? '基础')
    this.hideOverlay()
    this.rebuildTubes(true)
  }

  private save(): void {
    saveDraft('water-sort', {
      state: this.state,
      history: this.history.slice(-50),
      mode: this.mode
    })
  }

  private rebuildTubes(animated: boolean): void {
    this.selected = -1
    for (const view of this.tubeViews.values()) view.container.destroy(true)
    this.tubeViews.clear()

    const positions = this.computeTubePositions()
    this.state.tubes.forEach((tube, index) => {
      const position = positions[index]
      if (!position) return
      const view = this.createTubeView(index, position)
      this.tubeViews.set(index, view)
      this.renderLiquid(view, tube)
      this.paintGlass(view, false)

      if (animated) {
        view.container.setAlpha(0).setScale(position.scale * 0.90)
        this.tweens.add({
          targets: view.container,
          alpha: 1,
          scale: position.scale,
          duration: 180 + (index % 4) * 28,
          ease: 'Back.Out'
        })
      }
    })

    this.updateStats()
    this.refreshControls()
  }

  private reflowTubes(): void {
    const positions = this.computeTubePositions()
    for (const [index, view] of this.tubeViews) {
      const position = positions[index]
      if (!position) continue
      view.homeX = position.x
      view.homeY = position.y
      view.baseScale = position.scale
      view.container
        .setPosition(position.x, position.y)
        .setScale(position.scale)
        .setAngle(0)
      this.paintGlass(view, this.selected === index)
    }
  }

  private computeTubePositions(): TubePosition[] {
    const total = this.state.tubes.length
    const rows: number[] =
      total <= 5 ? [Math.ceil(total / 2), Math.floor(total / 2)]
      : total === 7 ? [4, 3]
      : [4, total - 4]

    const areaHeight = Math.max(560, this.layout.boardBottom - this.layout.boardTop)
    const centerY = this.layout.boardTop + areaHeight * 0.50
    const rowGap = Phaser.Math.Clamp(areaHeight * 0.46, 292, 390)
    const rowY = [centerY - rowGap / 2, centerY + rowGap / 2]
    const positions: TubePosition[] = []

    let index = 0
    rows.forEach((count, row) => {
      if (count <= 0) return
      const spacing = count >= 4 ? 158 : count === 3 ? 178 : 194
      const widthNeed = (count - 1) * spacing + TUBE_W
      const scale = Math.min(1.08, 680 / widthNeed)

      for (let col = 0; col < count; col++) {
        positions[index++] = {
          x: DESIGN_WIDTH / 2 + (col - (count - 1) / 2) * spacing * scale,
          y: rowY[row]!,
          scale
        }
      }
    })

    return positions
  }

  private createTubeView(index: number, position: TubePosition): TubeView {
    const container = this.add.container(position.x, position.y)
      .setScale(position.scale)
      .setDepth(40 + index)

    const shadow = this.add.graphics()
    const liquid = this.add.graphics()
    const symbols = this.add.container(0, 0)
    const glass = this.add.graphics()

    const badge = this.add.container(0, -145).setVisible(false)
    const badgeGlow = this.add.graphics()
    badgeGlow.fillStyle(WATER_UI.creamLight, 0.98)
    badgeGlow.fillCircle(0, 0, 18)
    badgeGlow.lineStyle(3, WATER_UI.honey, 0.95)
    badgeGlow.strokeCircle(0, 0, 17)
    const check = this.add.text(0, -1, '✓', {
      fontFamily: FONT,
      fontSize: '21px',
      color: '#2f8f6b',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    badge.add([badgeGlow, check])

    container.add([shadow, liquid, symbols, glass, badge])
    container.setSize(TUBE_W + 38, TUBE_H + 72)
    container.setInteractive(
      // Phaser 4 Container displayOrigin = size/2：hitArea 以左上角为原点。
      new Phaser.Geom.Rectangle(0, 0, TUBE_W + 38, TUBE_H + 72),
      Phaser.Geom.Rectangle.Contains
    )
    container.on('pointerdown', () => this.tapTube(index))

    return {
      index,
      container,
      shadow,
      liquid,
      symbols,
      glass,
      badge,
      homeX: position.x,
      homeY: position.y,
      baseScale: position.scale,
      complete: false
    }
  }

  private paintGlass(view: TubeView, selected: boolean): void {
    const g = view.glass
    g.clear()

    view.shadow.clear()
    view.shadow.fillStyle(WATER_UI.cocoa, selected ? 0.25 : 0.18)
    view.shadow.fillEllipse(0, 122, 84, 22)

    if (selected) {
      g.lineStyle(8, WATER_UI.honey, 0.34)
      g.strokeRoundedRect(-TUBE_W / 2 - 4, -TUBE_H / 2 - 4, TUBE_W + 8, TUBE_H + 8, {
        tl: 18, tr: 18, bl: 34, br: 34
      })
    }

    // Glass body
    g.fillStyle(0xffffff, 0.18)
    g.fillRoundedRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W, TUBE_H, {
      tl: 16, tr: 16, bl: 32, br: 32
    })
    g.lineStyle(4, selected ? 0xf0c66d : 0xf9fbef, selected ? 0.98 : 0.84)
    g.strokeRoundedRect(-TUBE_W / 2, -TUBE_H / 2, TUBE_W, TUBE_H, {
      tl: 16, tr: 16, bl: 32, br: 32
    })

    // Thick rim and subtle glass highlight
    g.fillStyle(0xffffff, 0.12)
    g.fillRoundedRect(-TUBE_W / 2 + 8, -TUBE_H / 2 + 14, 10, TUBE_H - 62, 5)
    g.lineStyle(3, 0xffffff, 0.78)
    g.strokeRoundedRect(-TUBE_W / 2 + 11, -TUBE_H / 2 + 12, TUBE_W - 22, TUBE_H - 30, {
      tl: 10, tr: 10, bl: 22, br: 22
    })
    g.fillStyle(0xffffff, 0.23)
    g.fillRoundedRect(-TUBE_W / 2 - 4, -TUBE_H / 2 - 10, TUBE_W + 8, 19, 9)
    g.lineStyle(3, 0xffffff, 0.90)
    g.strokeRoundedRect(-TUBE_W / 2 - 4, -TUBE_H / 2 - 10, TUBE_W + 8, 19, 9)
  }

  private renderLiquid(view: TubeView, tube: readonly number[]): void {
    const g = view.liquid
    g.clear()
    view.symbols.removeAll(true)

    tube.forEach((color, layer) => {
      const top = INNER_BOTTOM - (layer + 1) * LAYER_H
      const isBottom = layer === 0
      const isTop = layer === tube.length - 1
      const value = PALETTE[color] ?? 0x999999

      g.fillStyle(value, 0.97)
      if (isBottom) {
        g.fillRoundedRect(-INNER_W / 2, top, INNER_W, LAYER_H + 1, {
          tl: 0, tr: 0, bl: 23, br: 23
        })
      } else {
        g.fillRect(-INNER_W / 2, top, INNER_W, LAYER_H + 1)
      }

      // Light refraction on each band.
      g.fillStyle(0xffffff, 0.11)
      g.fillRect(-INNER_W / 2 + 5, top + 2, 7, LAYER_H - 4)

      if (isTop) {
        g.fillStyle(value, 1)
        g.fillEllipse(0, top + 2, INNER_W, 10)
        g.fillStyle(0xffffff, 0.17)
        g.fillEllipse(-10, top, INNER_W * 0.45, 5)
      }

      // Accessibility symbol remains subtle instead of becoming the main visual.
      const symbol = this.add.text(0, top + LAYER_H / 2 + 1, SYMBOLS[color] ?? '?', {
        fontFamily: FONT,
        fontSize: '17px',
        color: '#fffdf6',
        fontStyle: 'bold'
      }).setOrigin(0.5).setAlpha(0.52)
      view.symbols.add(symbol)
    })

    const complete = isTubeComplete(tube)
    if (complete !== view.complete) {
      view.complete = complete
      view.badge.setVisible(complete)
      if (complete) {
        view.badge.setScale(0.3).setAlpha(0)
        this.tweens.add({
          targets: view.badge,
          scale: 1,
          alpha: 1,
          duration: 250,
          ease: 'Back.Out'
        })
      }
    } else {
      view.badge.setVisible(complete)
    }
  }

  private tapTube(index: number): void {
    if (this.busy || this.state.won) return
    const tube = this.state.tubes[index]
    if (!tube) return

    if (this.selected < 0) {
      if (tube.length) this.selectTube(index)
      return
    }

    if (this.selected === index) {
      this.deselectTube()
      return
    }

    const from = this.selected
    if (canPour(this.state, from, index)) {
      this.animatePour(from, index)
      return
    }

    this.invalidPour(from, index)
  }

  private selectTube(index: number): void {
    this.deselectTube(false)
    const view = this.tubeViews.get(index)
    if (!view) return

    this.selected = index
    this.playLocal(WATER_SFX.lift, 0.31)
    this.paintGlass(view, true)
    this.tweens.add({
      targets: view.container,
      y: view.homeY - 20,
      scale: view.baseScale * 1.035,
      duration: 150,
      ease: 'Back.Out'
    })
  }

  private deselectTube(animate = true): void {
    if (this.selected < 0) return
    const view = this.tubeViews.get(this.selected)
    this.selected = -1
    if (!view) return

    this.paintGlass(view, false)
    if (animate) {
      this.tweens.add({
        targets: view.container,
        y: view.homeY,
        angle: 0,
        scale: view.baseScale,
        duration: 150,
        ease: 'Cubic.Out'
      })
    } else {
      view.container
        .setPosition(view.homeX, view.homeY)
        .setAngle(0)
        .setScale(view.baseScale)
    }
  }

  private invalidPour(fromIndex: number, targetIndex: number): void {
    const source = this.tubeViews.get(fromIndex)
    const target = this.tubeViews.get(targetIndex)
    this.playLocal(WATER_SFX.invalid, 0.34)
    this.showToast('只能倒进空瓶，或倒到相同颜色上')

    if (target) {
      this.tweens.add({
        targets: target.container,
        x: { from: target.homeX - 7, to: target.homeX + 7 },
        duration: 58,
        yoyo: true,
        repeat: 2,
        onComplete: () => target.container.setX(target.homeX)
      })
    }
    if (source) {
      this.tweens.add({
        targets: source.container,
        angle: { from: -3, to: 3 },
        duration: 65,
        yoyo: true,
        repeat: 1,
        onComplete: () => source.container.setAngle(0)
      })
    }
    // Keep source selected: user can immediately try another destination.
  }

  private animatePour(fromIndex: number, toIndex: number): void {
    const result = pour(this.state, fromIndex, toIndex)
    const sourceView = this.tubeViews.get(fromIndex)
    const targetView = this.tubeViews.get(toIndex)
    if (!result || !sourceView || !targetView) return

    const before = this.state
    const visualSource = [...before.tubes[fromIndex]!]
    const visualTarget = [...before.tubes[toIndex]!]
    const color = visualSource[visualSource.length - 1] ?? 0

    this.busy = true
    this.selected = -1
    this.refreshControls()
    this.paintGlass(sourceView, false)

    const direction = targetView.homeX >= sourceView.homeX ? 1 : -1
    const hoverX = targetView.homeX - direction * 82 * targetView.baseScale
    const hoverY = targetView.homeY - 155 * targetView.baseScale
    const pourAngle = direction > 0 ? 72 : -72

    sourceView.container.setDepth(320)

    this.tweens.add({
      targets: sourceView.container,
      x: hoverX,
      y: hoverY,
      angle: pourAngle,
      scale: sourceView.baseScale * 1.03,
      duration: 245,
      ease: 'Cubic.InOut',
      onComplete: () => {
        this.playLocal(WATER_SFX.pour, 0.38)
        const stream = this.createStream(sourceView, targetView, direction, color)

        for (let step = 0; step < result.poured; step++) {
          this.time.delayedCall(95 + step * 105, () => {
            if (!this.alive) return
            visualSource.pop()
            visualTarget.push(color)
            this.renderLiquid(sourceView, visualSource)
            this.renderLiquid(targetView, visualTarget)
            this.spawnDroplet(targetView, color)
          })
        }

        const finishDelay = 150 + result.poured * 105
        this.time.delayedCall(finishDelay, () => {
          stream.destroy()
          if (!this.alive) return

          this.history.push(before)
          if (this.history.length > 50) this.history.shift()
          this.state = result.state
          this.save()
          this.updateStats()

          const targetWasComplete = targetView.complete
          this.renderLiquid(sourceView, this.state.tubes[fromIndex]!)
          this.renderLiquid(targetView, this.state.tubes[toIndex]!)

          this.tweens.add({
            targets: sourceView.container,
            x: sourceView.homeX,
            y: sourceView.homeY,
            angle: 0,
            scale: sourceView.baseScale,
            duration: 260,
            ease: 'Back.Out',
            onComplete: () => {
              sourceView.container.setDepth(40 + fromIndex)
              this.busy = false
              this.refreshControls()
              if (this.state.won) {
                this.time.delayedCall(170, () => this.showVictory())
              }
            }
          })

          this.tweens.add({
            targets: targetView.container,
            scaleY: targetView.baseScale * 0.965,
            duration: 90,
            yoyo: true,
            ease: 'Sine.InOut',
            onComplete: () => targetView.container.setScale(targetView.baseScale)
          })

          if (!targetWasComplete && isTubeComplete(this.state.tubes[toIndex]!)) {
            this.playLocal(WATER_SFX.complete, 0.34)
          }
        })
      }
    })
  }

  private createStream(
    source: TubeView,
    target: TubeView,
    direction: number,
    color: number
  ): Phaser.GameObjects.Graphics {
    const startX = source.container.x + direction * 54 * source.baseScale
    const startY = source.container.y - 13 * source.baseScale
    const endX = target.homeX
    const endY = target.homeY - 126 * target.baseScale

    const stream = this.add.graphics().setDepth(300)
    stream.lineStyle(13, PALETTE[color] ?? 0x999999, 0.88)
    stream.beginPath()
    stream.moveTo(startX, startY)
    stream.lineTo(endX, endY)
    stream.strokePath()
    stream.lineStyle(4, 0xffffff, 0.18)
    stream.beginPath()
    stream.moveTo(startX - 2, startY)
    stream.lineTo(endX - 2, endY)
    stream.strokePath()
    stream.setAlpha(0)

    this.tweens.add({
      targets: stream,
      alpha: { from: 0, to: 1 },
      duration: 70,
      yoyo: true,
      hold: 270
    })
    return stream
  }

  private spawnDroplet(target: TubeView, color: number): void {
    const dot = this.add.circle(
      target.homeX + Phaser.Math.Between(-10, 10),
      target.homeY - 124 * target.baseScale,
      5,
      PALETTE[color] ?? 0x999999,
      0.9
    ).setDepth(305)

    this.tweens.add({
      targets: dot,
      y: target.homeY - 94 * target.baseScale,
      alpha: 0,
      duration: 150,
      ease: 'Quad.In',
      onComplete: () => dot.destroy()
    })
  }

  private undoMove(): void {
    if (this.busy || !this.history.length) return
    this.playLocal(WATER_SFX.ui, 0.22)
    this.deselectTube(false)
    this.state = this.history.pop()!
    this.rebuildTubes(true)
    this.save()
  }

  private showHint(): void {
    if (this.busy || this.state.won) return
    this.playLocal(WATER_SFX.ui, 0.20)
    this.deselectTube(false)

    const path = solvePath(this.state, 250_000)
    const move = path?.[0]
    if (!move) {
      this.showToast(path ? '已经整理完成啦' : '这一步有点难，我暂时没找到提示')
      return
    }

    const source = this.tubeViews.get(move.from)
    const target = this.tubeViews.get(move.to)
    if (!source || !target) return

    const arrow = this.add.graphics().setDepth(360)
    arrow.lineStyle(7, WATER_UI.honey, 0.96)
    arrow.beginPath()
    arrow.moveTo(source.homeX, source.homeY - 145 * source.baseScale)
    arrow.lineTo(target.homeX, target.homeY - 145 * target.baseScale)
    arrow.strokePath()

    const angle = Phaser.Math.Angle.Between(
      source.homeX,
      source.homeY - 145 * source.baseScale,
      target.homeX,
      target.homeY - 145 * target.baseScale
    )
    const tx = target.homeX
    const ty = target.homeY - 145 * target.baseScale
    arrow.fillStyle(WATER_UI.honey, 1)
    arrow.fillTriangle(
      tx,
      ty,
      tx - Math.cos(angle - 0.55) * 18,
      ty - Math.sin(angle - 0.55) * 18,
      tx - Math.cos(angle + 0.55) * 18,
      ty - Math.sin(angle + 0.55) * 18
    )

    this.showToast('先点发光的瓶子，再倒进另一瓶')

    const rings: Phaser.GameObjects.Graphics[] = []
    ;[source, target].forEach((view, index) => {
      const ring = this.add.graphics().setDepth(355)
      ring.lineStyle(7, index === 0 ? WATER_UI.honey : WATER_UI.sage, 0.95)
      ring.strokeRoundedRect(
        view.homeX - 56 * view.baseScale,
        view.homeY - 134 * view.baseScale,
        112 * view.baseScale,
        268 * view.baseScale,
        34 * view.baseScale
      )
      rings.push(ring)
      this.tweens.add({
        targets: ring,
        alpha: { from: 0.22, to: 1 },
        duration: 330,
        yoyo: true,
        repeat: 2,
        onComplete: () => ring.destroy()
      })
    })

    arrow.setAlpha(0.2)
    this.tweens.add({
      targets: arrow,
      alpha: 1,
      duration: 280,
      yoyo: true,
      repeat: 2,
      onComplete: () => arrow.destroy()
    })
  }

  private updateStats(): void {
    this.movesChip.setText(`${this.state.moves} 步`)
    this.doneChip.setText(`完成 ${completedCount(this.state)}/${this.state.colors}`)
  }

  private refreshControls(): void {
    this.undoButton.setEnabled(!this.busy && this.history.length > 0)
    this.hintButton.setEnabled(!this.busy && !this.state.won)
    this.newButton.setEnabled(!this.busy)
  }

  private playLocal(key: string, volume: number): void {
    if (this.audio.isMuted || !this.cache.audio.exists(key)) return
    try {
      this.sound.play(key, { volume })
    } catch {
      // First interaction can precede WebAudio unlock on some mobile browsers.
    }
  }

  private showToast(message: string, timeout = 1600): void {
    this.hideToast()
    const y = Math.max(this.layout?.statsY + 52 || 140, 142)
    const toast = this.add.container(DESIGN_WIDTH / 2, y).setDepth(520)
    const shadow = this.add.graphics()
    shadow.fillStyle(WATER_UI.cocoa, 0.22)
    shadow.fillRoundedRect(-210, -25 + 6, 420, 54, 27)
    const face = this.add.graphics()
    face.fillStyle(WATER_UI.forest, 0.96)
    face.fillRoundedRect(-210, -27, 420, 54, 27)
    const text = this.add.text(0, 0, message, {
      fontFamily: FONT,
      fontSize: '17px',
      color: '#fffdf6',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5)
    toast.add([shadow, face, text])
    toast.setAlpha(0).setScale(0.94)
    this.tweens.add({ targets: toast, alpha: 1, scale: 1, duration: 150, ease: 'Back.Out' })
    this.toast = toast

    if (timeout > 0) {
      this.time.delayedCall(timeout, () => {
        if (this.toast !== toast) return
        this.tweens.add({
          targets: toast,
          alpha: 0,
          y: y - 8,
          duration: 170,
          onComplete: () => {
            if (this.toast === toast) this.toast = undefined
            toast.destroy(true)
          }
        })
      })
    }
  }

  private hideToast(): void {
    this.toast?.destroy(true)
    this.toast = undefined
  }

  private showResumeOverlay(saved: WaterSortDraft): void {
    this.busy = true
    this.refreshControls()
    const panel = this.createPanel('继续上次吗？', '找到一局还没有整理完的水排序')
    const continueButton = this.makePanelButton(0, 42, '继续上次', () => {
      this.playLocal(WATER_SFX.ui, 0.22)
      panel.root.destroy(true)
      if (this.overlay === panel.root) this.overlay = undefined
      this.resume(saved)
    }, true)
    const freshButton = this.makePanelButton(0, 112, '新开一局', () => {
      this.playLocal(WATER_SFX.ui, 0.22)
      saveDraft('water-sort', null)
      panel.root.destroy(true)
      if (this.overlay === panel.root) this.overlay = undefined
      this.startFresh(saved.mode)
    }, false)
    panel.card.add([continueButton, freshButton])
    this.overlay = panel.root
  }

  private showVictory(): void {
    if (this.overlay) return
    recordFlag('water-sort-clear')
    this.playLocal(WATER_SFX.victory, 0.48)
    this.save()

    const panel = this.createPanel('全部分好啦！', `${this.state.moves} 步完成`)
    const replay = this.makePanelButton(0, 42, '再来一局', () => {
      this.playLocal(WATER_SFX.ui, 0.22)
      panel.root.destroy(true)
      if (this.overlay === panel.root) this.overlay = undefined
      this.startFresh(this.mode)
    }, true)
    const home = this.makePanelButton(0, 112, '回游戏屋', () => {
      this.playLocal(WATER_SFX.ui, 0.22)
      this.exitGame()
    }, false)
    panel.card.add([replay, home])
    this.overlay = panel.root
  }

  private createPanel(
    titleValue: string,
    subtitleValue: string
  ): { root: Phaser.GameObjects.Container; card: Phaser.GameObjects.Container } {
    const h = this.scale.height
    const root = this.add.container(0, 0).setDepth(600)
    const shade = this.add.rectangle(DESIGN_WIDTH / 2, h / 2, DESIGN_WIDTH, h, WATER_UI.forestDark, 0.37)
      .setInteractive()

    const card = this.add.container(DESIGN_WIDTH / 2, h / 2)
    const shadow = this.add.graphics()
    shadow.fillStyle(WATER_UI.cocoa, 0.27)
    shadow.fillRoundedRect(-270, -188 + 12, 540, 376, 42)
    const panel = this.add.graphics()
    panel.fillStyle(WATER_UI.creamLight, 0.995)
    panel.fillRoundedRect(-270, -188, 540, 376, 42)
    panel.lineStyle(4, WATER_UI.honey, 0.82)
    panel.strokeRoundedRect(-268, -186, 536, 372, 40)

    const decor = this.add.graphics()
    decor.fillStyle(WATER_UI.sage, 1)
    decor.fillEllipse(-202, -148, 48, 20)
    decor.fillEllipse(202, -148, 48, 20)
    decor.fillStyle(WATER_UI.honey, 1)
    decor.fillCircle(-187, -148, 7)
    decor.fillCircle(187, -148, 7)

    const title = this.add.text(0, -96, titleValue, {
      fontFamily: FONT,
      fontSize: '35px',
      color: '#285c50',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    const subtitle = this.add.text(0, -50, subtitleValue, {
      fontFamily: FONT,
      fontSize: '17px',
      color: '#6b5947',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    card.add([shadow, panel, decor, title, subtitle])
    root.add([shade, card])
    root.setAlpha(0)
    card.setScale(0.92)
    this.tweens.add({ targets: root, alpha: 1, duration: 170 })
    this.tweens.add({ targets: card, scale: 1, duration: 270, ease: 'Back.Out' })
    return { root, card }
  }

  private makePanelButton(
    x: number,
    y: number,
    label: string,
    action: () => void,
    primary: boolean
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y)
    const shadow = this.add.graphics()
    const face = this.add.graphics()
    const text = this.add.text(0, -1, label, {
      fontFamily: FONT,
      fontSize: '20px',
      color: primary ? '#fffdf6' : '#285c50',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const paint = (pressed = false): void => {
      shadow.clear()
      shadow.fillStyle(WATER_UI.cocoa, 0.22)
      shadow.fillRoundedRect(-154, -28 + 7, 308, 58, 22)
      face.clear()
      face.fillStyle(
        primary ? (pressed ? WATER_UI.forestDark : WATER_UI.forest) : (pressed ? 0xeadfbe : WATER_UI.cream),
        1
      )
      face.fillRoundedRect(-154, -30 + (pressed ? 4 : 0), 308, 58, 22)
      face.lineStyle(2, primary ? 0xffffff : WATER_UI.honey, primary ? 0.12 : 0.70)
      face.strokeRoundedRect(-152, -28 + (pressed ? 4 : 0), 304, 54, 20)
      text.y = pressed ? 3 : -1
    }

    paint()
    button.add([shadow, face, text])
    button.setSize(308, 58)
    button.setInteractive(new Phaser.Geom.Rectangle(0, 0, 308, 58), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => { paint(true); button.setScale(0.98) })
      .on('pointerup', () => {
        paint(false)
        button.setScale(1)
        action()
      })
      .on('pointerout', () => { paint(false); button.setScale(1) })
    return button
  }

  private hideOverlay(): void {
    this.overlay?.destroy(true)
    this.overlay = undefined
  }
}
