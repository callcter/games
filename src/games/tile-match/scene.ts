import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { releaseHostBackdrop, setHostBackdrop } from '../../platform/display/host-backdrop'
import { recordFlag } from '../puzzle-kit/progress'
import {
  isStuck,
  MODES,
  newMatch,
  pick,
  pickable,
  shuffle,
  SLOT_SIZE,
  undo,
  type Tile
} from './core/game'
import {
  matchSheetReady,
  MATCH_BG_KEY,
  MATCH_SFX,
  MATCH_SHEET_KEY,
  preloadMatchArt,
  TILE_KIND_FRAME
} from './art'
import {
  COZY,
  createCozyIconButton,
  createCozyPillButton,
  createCozyToolButton,
  type CozyIconButton,
  type CozyPillButton,
  type CozyToolButton
} from './cozy-ui'

const DESIGN_WIDTH = 768
const TILE = 100
const SPACING = 100
const SLOT_GAP = 80
const FONT = 'Avenir Next, PingFang SC, sans-serif'

const FALLBACK = ['🍏', '🍌', '🍇', '🍉', '🍊', '🍓', '🍒', '🥝', '🍍', '🥭']
const BURST_COLORS = [0x9ccd45, 0xf2cf45, 0x8f62c8, 0xef6262, 0xf59b38, 0xef5770, 0xd6404f, 0x76bf4f, 0xe7b73d, 0xf18b35]

interface Layout {
  height: number
  topY: number
  boardTop: number
  boardBottom: number
  trayY: number
  bottomY: number
}

interface TileView {
  tile: Tile
  container: Phaser.GameObjects.Container
  body: Phaser.GameObjects.Graphics
  face: Phaser.GameObjects.Image | Phaser.GameObjects.Text
  baseScale: number
  location: 'board' | 'slot'
  free: boolean
}

export class TileMatchScene extends Phaser.Scene {
  private mode = 0
  private state = newMatch(0)
  private busy = false
  private useArt = false

  private readonly audio: GameAudio
  private readonly exitGame: () => void

  private background?: Phaser.GameObjects.Image
  private tint?: Phaser.GameObjects.Rectangle
  private layout!: Layout

  private tileViews = new Map<number, TileView>()
  private boardPositions = new Map<number, { x: number; y: number; scale: number }>()
  private available = new Set<number>()

  private trayBase!: Phaser.GameObjects.Graphics
  private trayDecor!: Phaser.GameObjects.Graphics

  private backButton!: CozyIconButton
  private soundButton!: CozyIconButton
  private undoButton!: CozyToolButton
  private shuffleButton!: CozyToolButton
  private restartButton!: CozyToolButton
  private modeButton!: CozyPillButton
  private trayLabel!: Phaser.GameObjects.Text

  private toast?: Phaser.GameObjects.Container
  private resultOverlay?: Phaser.GameObjects.Container

  constructor(audio: GameAudio, exit: () => void) {
    super('tile-match')
    this.audio = audio
    this.exitGame = exit
  }

  preload(): void {
    preloadMatchArt(this)
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#c88a4b')
    this.useArt = matchSheetReady(this)

    if (this.textures.exists(MATCH_BG_KEY)) {
      this.background = this.add.image(0, 0, MATCH_BG_KEY).setOrigin(0.5).setDepth(-30)
      setHostBackdrop('art/tile-match-bg.png')
      const release = (): void => releaseHostBackdrop()
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, release)
      this.events.once(Phaser.Scenes.Events.DESTROY, release)
    }

    this.tint = this.add.rectangle(0, 0, 1, 1, 0x5f412d, 0.055).setOrigin(0).setDepth(-20)
    this.input.on('pointerdown', () => void this.audio.unlock())

    this.createControls()
    this.createTray()
    this.layoutScene()
    this.rebuildBoard(false)

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this)
    })
  }

  private handleResize(): void {
    this.layoutScene()
    if (!this.busy) this.reflowViews()
  }

  private currentLayout(): Layout {
    const h = this.scale.height
    // v2 在长屏手机把 trayY 封顶到 1260，导致托盘和底部工具之间被拉出几百像素空档。
    // v3 把“托盘 + 工具”作为一个底部控制簇整体锚定，长屏只把更多空间让给棋盘/背景。
    const topY = Phaser.Math.Clamp(h * 0.056, 62, 86)
    const bottomY = h - Phaser.Math.Clamp(h * 0.067, 82, 112)
    const trayY = bottomY - 150
    const boardTop = topY + 92
    const boardBottom = trayY - 112
    return { height: h, topY, boardTop, boardBottom, trayY, bottomY }
  }

  private layoutScene(): void {
    this.layout = this.currentLayout()
    const { height, topY, trayY, bottomY } = this.layout

    if (this.background) {
      const source = this.textures.get(MATCH_BG_KEY).source[0]
      if (source) {
        const cover = Math.max(DESIGN_WIDTH / source.width, height / source.height)
        this.background
          .setPosition(DESIGN_WIDTH / 2, height / 2)
          .setDisplaySize(source.width * cover, source.height * cover)
      }
    }
    this.tint?.setSize(DESIGN_WIDTH, height)

    this.backButton?.setPosition(58, topY)
    this.soundButton?.setPosition(DESIGN_WIDTH - 58, topY)
    this.modeButton?.setPosition(DESIGN_WIDTH / 2, topY)

    this.undoButton?.setPosition(DESIGN_WIDTH / 2 - 162, bottomY)
    this.shuffleButton?.setPosition(DESIGN_WIDTH / 2, bottomY)
    this.restartButton?.setPosition(DESIGN_WIDTH / 2 + 162, bottomY)

    this.paintTray()
    this.trayBase?.setPosition(0, trayY)
    this.trayDecor?.setPosition(0, trayY)
    this.trayLabel?.setPosition(DESIGN_WIDTH / 2, trayY - 58)
  }

  private createControls(): void {
    this.backButton = createCozyIconButton(this, 'back', () => {
      this.playLocal(MATCH_SFX.ui, 0.24)
      this.exitGame()
    }, 31)

    this.soundButton = createCozyIconButton(this, this.audio.isMuted ? 'muted' : 'sound', () => {
      const wasMuted = this.audio.isMuted
      this.audio.toggleMuted()
      this.soundButton.setIcon(this.audio.isMuted ? 'muted' : 'sound')
      if (wasMuted && !this.audio.isMuted) this.playLocal(MATCH_SFX.ui, 0.22)
    }, 31)

    this.modeButton = createCozyPillButton(this, this.mode, MODES.length, MODES[this.mode]?.label ?? '基础', () => {
      if (this.busy) return
      this.playLocal(MATCH_SFX.ui, 0.25)
      this.mode = (this.mode + 1) % MODES.length
      this.modeButton.setMode(this.mode, MODES.length, MODES[this.mode]?.label ?? '基础')
      this.state = newMatch(this.mode)
      this.playLocal(MATCH_SFX.shuffle, 0.25)
      this.rebuildBoard(true)
    })

    this.undoButton = createCozyToolButton(this, 'undo', '撤销', () => this.undoMove())
    this.shuffleButton = createCozyToolButton(this, 'shuffle', '洗牌', () => this.shuffleBoard())
    this.restartButton = createCozyToolButton(this, 'restart', '重开', () => this.restart())
  }

  private createTray(): void {
    this.trayBase = this.add.graphics().setDepth(2)
    this.trayDecor = this.add.graphics().setDepth(4)
    this.trayLabel = this.add.text(0, 0, '', {
      fontFamily: FONT,
      fontSize: '16px',
      color: '#fff8df',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7)
    this.paintTray()
  }

  private paintTray(alert = isStuck(this.state)): void {
    if (!this.trayBase || !this.trayDecor) return
    this.trayBase.clear()
    this.trayBase.fillStyle(COZY.cocoa, 0.24)
    this.trayBase.fillRoundedRect(54, -55 + 10, 660, 128, 34)
    this.trayBase.fillStyle(alert ? 0xffe5d9 : COZY.cream, 0.99)
    this.trayBase.fillRoundedRect(54, -58, 660, 128, 34)
    this.trayBase.lineStyle(4, alert ? COZY.coral : COZY.honey, alert ? 0.96 : 0.90)
    this.trayBase.strokeRoundedRect(56, -56, 656, 124, 32)

    // v2 顶部两个椭圆像“花生”，没有语义。v3 改成明确的收集状态标签。
    this.trayBase.fillStyle(COZY.forest, 0.99)
    this.trayBase.fillRoundedRect(309, -76, 150, 36, 18)
    this.trayBase.lineStyle(2, COZY.honey, 0.74)
    this.trayBase.strokeRoundedRect(311, -74, 146, 32, 16)

    this.trayDecor.clear()
    for (let index = 0; index < SLOT_SIZE; index++) {
      const x = this.slotX(index)
      this.trayDecor.fillStyle(0x9b6f3d, 0.25)
      this.trayDecor.fillRoundedRect(x - 34, -30 + 5, 68, 68, 16)
      this.trayDecor.fillStyle(0xfffdf2, 0.84)
      this.trayDecor.fillRoundedRect(x - 34, -30, 68, 68, 16)
      this.trayDecor.lineStyle(2.2, 0xd6bd83, 0.88)
      this.trayDecor.strokeRoundedRect(x - 33, -29, 66, 66, 15)
    }
  }

  private restart(): void {
    if (this.busy) return
    this.playLocal(MATCH_SFX.ui, 0.22)
    this.state = newMatch(this.mode)
    this.playLocal(MATCH_SFX.shuffle, 0.20)
    this.rebuildBoard(true)
  }

  private undoMove(): void {
    if (this.busy) return
    const restored = undo(this.state)
    if (!restored) {
      this.showToast(this.state.undos <= 0 ? '撤销次数用完啦' : '还没有可以撤销的牌')
      return
    }
    this.playLocal(MATCH_SFX.ui, 0.22)
    this.state = restored
    this.audio.playMove()
    this.rebuildBoard(true)
  }

  private shuffleBoard(): void {
    if (this.busy) return
    const shuffled = shuffle(this.state)
    if (!shuffled) {
      this.showToast(this.state.shuffles <= 0 ? '洗牌次数用完啦' : '这次没有洗好，再试一次')
      return
    }
    this.state = shuffled
    this.playLocal(MATCH_SFX.shuffle, 0.34)
    this.rebuildBoard(true)
  }

  /**
   * 低频操作允许重建；正常“点牌→飞入→凑三”路径不调用此方法。
   */
  private rebuildBoard(animated: boolean): void {
    this.busy = false
    this.resultOverlay?.destroy(true)
    this.resultOverlay = undefined
    this.hideToast()
    this.paintTray(false)

    for (const view of this.tileViews.values()) view.container.destroy(true)
    this.tileViews.clear()

    this.computeBoardPositions()
    this.available = new Set(pickable(this.state))
    const gone = new Set(this.state.gone)

    const boardTiles = this.state.tiles
      .filter(tile => !gone.has(tile.id) && !this.state.slot.includes(tile.id))
      .sort((a, b) => a.layer - b.layer)

    for (const tile of boardTiles) {
      const pos = this.boardPositions.get(tile.id)
      if (!pos) continue
      const view = this.createTileView(tile, pos.x, pos.y, 'board', pos.scale)
      this.tileViews.set(tile.id, view)
      this.setTileFree(view, this.available.has(tile.id), false)
      if (animated) {
        const target = view.baseScale
        view.container.setScale(target * 0.86).setAlpha(0)
        this.tweens.add({
          targets: view.container,
          scale: target,
          alpha: 1,
          duration: 180 + tile.layer * 20,
          ease: 'Back.Out'
        })
      }
    }

    this.state.slot.forEach((id, index) => {
      const tile = this.state.tiles.find(entry => entry.id === id)
      if (!tile) return
      const view = this.createTileView(tile, this.slotX(index), this.layout.trayY, 'slot', 0.70)
      view.container.disableInteractive()
      this.tileViews.set(id, view)
    })

    this.refreshControls()
    this.refreshStuckState()
  }

  private reflowViews(): void {
    this.computeBoardPositions()

    for (const view of this.tileViews.values()) {
      if (view.location === 'slot') continue
      const pos = this.boardPositions.get(view.tile.id)
      if (!pos) continue
      view.baseScale = pos.scale
      view.container.setPosition(pos.x, pos.y).setScale(pos.scale)
    }

    this.state.slot.forEach((id, index) => {
      const view = this.tileViews.get(id)
      if (!view) return
      view.container.setPosition(this.slotX(index), this.layout.trayY).setScale(0.70)
    })
  }

  private computeBoardPositions(): void {
    this.boardPositions.clear()
    const maxX = Math.max(...this.state.tiles.map(tile => tile.gx))
    const maxY = Math.max(...this.state.tiles.map(tile => tile.gy))
    const minX = Math.min(...this.state.tiles.map(tile => tile.gx))
    const minY = Math.min(...this.state.tiles.map(tile => tile.gy))

    const rawWidth = (maxX - minX) * SPACING + TILE
    const rawHeight = (maxY - minY) * SPACING + TILE
    const areaWidth = 660
    const areaHeight = Math.max(280, this.layout.boardBottom - this.layout.boardTop)
    const boardScale = Math.min(1.15, areaWidth / rawWidth, areaHeight / rawHeight)

    const boardWidth = rawWidth * boardScale
    const boardHeight = rawHeight * boardScale
    const left = (DESIGN_WIDTH - boardWidth) / 2
    const top = this.layout.boardTop + (areaHeight - boardHeight) * 0.42

    for (const tile of this.state.tiles) {
      const gx = tile.gx
      const gy = tile.gy
      this.boardPositions.set(tile.id, {
        x: left + ((gx - minX) * SPACING + TILE / 2) * boardScale,
        y: top + ((gy - minY) * SPACING + TILE / 2) * boardScale,
        scale: boardScale * (1 - tile.layer * 0.024)
      })
    }
  }

  private createTileView(
    tile: Tile,
    x: number,
    y: number,
    location: 'board' | 'slot',
    baseScale: number
  ): TileView {
    const container = this.add.container(x, y).setDepth(location === 'board' ? 20 + tile.layer : 120)
    const body = this.add.graphics()
    container.add(body)

    const frame = this.useArt ? TILE_KIND_FRAME[tile.kind] ?? -1 : -1
    let face: Phaser.GameObjects.Image | Phaser.GameObjects.Text
    if (frame >= 0) {
      face = this.add.image(0, -2, MATCH_SHEET_KEY, frame).setDisplaySize(TILE * 0.69, TILE * 0.69)
    } else {
      face = this.add.text(0, -1, FALLBACK[tile.kind] ?? '?', { fontSize: '47px' }).setOrigin(0.5)
    }
    container.add(face)

    container.setScale(baseScale)
    container.setSize(TILE, TILE)
    container
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, TILE, TILE),
        Phaser.Geom.Rectangle.Contains
      )
      .on('pointerdown', () => {
        if (location !== 'board' || this.busy) return
        this.take(tile.id)
      })

    const view: TileView = {
      tile,
      container,
      body,
      face,
      baseScale,
      location,
      free: location === 'slot'
    }

    this.paintTile(view, location === 'slot' || this.available.has(tile.id))
    if (location === 'slot') container.disableInteractive()
    return view
  }

  private paintTile(view: TileView, free: boolean): void {
    view.free = free
    const g = view.body
    g.clear()

    // 厚牌底层阴影 + 蜂蜜色侧边，比纯白卡片更像实体玩具。
    g.fillStyle(COZY.cocoa, free ? 0.22 : 0.12)
    g.fillRoundedRect(-TILE / 2, -TILE / 2 + 8, TILE, TILE, 21)
    g.fillStyle(0xc88a43, free ? 0.82 : 0.42)
    g.fillRoundedRect(-TILE / 2, -TILE / 2 + 5, TILE, TILE - 1, 21)
    g.fillStyle(free ? COZY.creamLight : 0xe9e0cc, 0.995)
    g.fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE - 7, 20)
    g.lineStyle(2.4, free ? 0xffffff : 0xc7bba6, free ? 0.94 : 0.60)
    g.strokeRoundedRect(-TILE / 2 + 1, -TILE / 2 + 1, TILE - 2, TILE - 9, 19)

    if (!free && view.location === 'board') {
      g.fillStyle(0x4b443d, 0.24)
      g.fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE - 7, 20)
    }

    view.face.setAlpha(free ? 1 : 0.27)
  }

  private setTileFree(view: TileView, free: boolean, animateNew: boolean): void {
    const wasFree = view.free
    this.paintTile(view, free)
    if (view.location !== 'board') return

    if (view.container.input) view.container.input.enabled = free && !isStuck(this.state)

    if (free && !wasFree && animateNew) {
      const target = view.baseScale
      this.tweens.add({
        targets: view.container,
        scale: { from: target * 0.91, to: target * 1.055 },
        duration: 120,
        yoyo: true,
        ease: 'Sine.Out',
        onComplete: () => view.container.setScale(target)
      })
    }
  }

  private syncAvailability(animateNew = true): void {
    const next = new Set(pickable(this.state))
    for (const [id, view] of this.tileViews) {
      if (view.location !== 'board' || this.state.gone.includes(id)) continue
      this.setTileFree(view, next.has(id), animateNew)
    }
    this.available = next
  }

  private take(tileId: number): void {
    if (this.busy || isStuck(this.state)) return
    const view = this.tileViews.get(tileId)
    if (!view || view.location !== 'board' || !this.available.has(tileId)) return

    const beforeSlot = [...this.state.slot]
    const result = pick(this.state, tileId)
    if (!result) return

    this.busy = true
    this.hideToast()

    const targetIndex = beforeSlot.length
    const targetX = this.slotX(targetIndex)

    view.location = 'slot'
    view.container.disableInteractive()
    view.container.setDepth(220)

    this.playLocal(MATCH_SFX.pick, 0.38)

    this.tweens.add({
      targets: view.container,
      x: targetX,
      y: this.layout.trayY,
      scale: 0.70,
      angle: 0,
      duration: 225,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.state = result.state
        view.container.setDepth(120)
        this.paintTile(view, true)

        if (result.cleared.length) {
          this.animateMatch(result.cleared, view.tile.kind)
          return
        }

        this.playLocal(MATCH_SFX.land, 0.30)
        this.syncAvailability(true)
        this.refreshControls()
        this.refreshStuckState()
        this.busy = false
      }
    })
  }

  private animateMatch(ids: number[], kind: number): void {
    const views = ids
      .map(id => this.tileViews.get(id))
      .filter((view): view is TileView => Boolean(view))

    this.playLocal(MATCH_SFX.match, 0.45)

    const centerX = views.length
      ? views.reduce((sum, view) => sum + view.container.x, 0) / views.length
      : DESIGN_WIDTH / 2
    this.burstMatch(centerX, this.layout.trayY, kind)

    this.tweens.add({
      targets: views.map(view => view.container),
      y: this.layout.trayY - 9,
      scale: 0.78,
      duration: 85,
      ease: 'Sine.Out',
      onComplete: () => {
        this.tweens.add({
          targets: views.map(view => view.container),
          scale: 1.02,
          alpha: 0,
          y: this.layout.trayY - 27,
          duration: 175,
          ease: 'Back.In',
          onComplete: () => {
            for (const view of views) {
              this.tileViews.delete(view.tile.id)
              view.container.destroy(true)
            }

            this.relayoutSlot()
            this.syncAvailability(true)
            this.refreshControls()
            this.refreshStuckState()
            this.busy = false

            if (this.state.won) this.showVictory()
          }
        })
      }
    })
  }

  private relayoutSlot(): void {
    this.state.slot.forEach((id, index) => {
      const view = this.tileViews.get(id)
      if (!view) return
      view.location = 'slot'
      view.container.disableInteractive()
      view.container.setDepth(120)
      this.tweens.add({
        targets: view.container,
        x: this.slotX(index),
        y: this.layout.trayY,
        scale: 0.70,
        duration: 175,
        ease: 'Cubic.Out'
      })
    })
  }

  private refreshStuckState(): void {
    const stuck = isStuck(this.state)
    this.paintTray(stuck)

    for (const [id, view] of this.tileViews) {
      if (view.location !== 'board' || !view.container.input) continue
      view.container.input.enabled = !stuck && this.available.has(id)
    }

    if (stuck) {
      this.showToast('槽满啦，撤销一步或洗牌吧')
      this.tweens.add({
        targets: [this.trayBase, this.trayDecor],
        alpha: { from: 0.67, to: 1 },
        duration: 175,
        yoyo: true,
        repeat: 1
      })
    }
  }

  private refreshControls(): void {
    this.undoButton.setBadge(this.state.undos)
    this.shuffleButton.setBadge(this.state.shuffles)
    this.undoButton.setEnabled(!this.busy)
    this.shuffleButton.setEnabled(!this.busy)
    this.trayLabel.setText(`收集 ${this.state.slot.length}/${SLOT_SIZE}`)
  }

  private slotX(index: number): number {
    return DESIGN_WIDTH / 2 + (index - (SLOT_SIZE - 1) / 2) * SLOT_GAP
  }

  private playLocal(key: string, volume: number): void {
    if (this.audio.isMuted || !this.cache.audio.exists(key)) return
    try {
      this.sound.play(key, { volume })
    } catch {
      // 首个用户手势前 WebAudio 可能还未解锁：静默跳过，不阻断游戏。
    }
  }

  private burstMatch(x: number, y: number, kind: number): void {
    const color = BURST_COLORS[kind] ?? 0xf2c94c
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + 0.15
      const distance = 44 + (i % 3) * 12
      const dot = this.add.circle(x, y, i % 2 ? 6 : 4, color, 0.96).setDepth(260)
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.25,
        duration: 340,
        ease: 'Cubic.Out',
        onComplete: () => dot.destroy()
      })
    }
  }

  private showToast(message: string): void {
    this.hideToast()
    const y = this.layout.trayY - 102
    const toast = this.add.container(DESIGN_WIDTH / 2, y).setDepth(300)
    const shadow = this.add.graphics()
    shadow.fillStyle(COZY.cocoa, 0.24)
    shadow.fillRoundedRect(-184, -25 + 6, 368, 54, 27)
    const bg = this.add.graphics()
    bg.fillStyle(COZY.forest, 0.96)
    bg.fillRoundedRect(-184, -27, 368, 54, 27)
    const text = this.add.text(0, 0, message, {
      fontFamily: FONT,
      fontSize: '18px',
      color: '#fffdf6',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    toast.add([shadow, bg, text])
    toast.setScale(0.92).setAlpha(0)
    this.tweens.add({ targets: toast, scale: 1, alpha: 1, duration: 145, ease: 'Back.Out' })
    this.toast = toast

    if (!isStuck(this.state)) {
      this.time.delayedCall(1500, () => {
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

  private showVictory(): void {
    if (this.resultOverlay) return

    recordFlag('tile-match-clear')
    this.playLocal(MATCH_SFX.victory, 0.48)

    const h = this.scale.height
    const overlay = this.add.container(0, 0).setDepth(500)
    const shade = this.add.rectangle(DESIGN_WIDTH / 2, h / 2, DESIGN_WIDTH, h, COZY.forestDark, 0.34)
      .setInteractive()

    const card = this.add.container(DESIGN_WIDTH / 2, h / 2)
    const shadow = this.add.graphics()
    shadow.fillStyle(COZY.cocoa, 0.25)
    shadow.fillRoundedRect(-266, -176 + 12, 532, 354, 42)
    const panel = this.add.graphics()
    panel.fillStyle(COZY.creamLight, 0.995)
    panel.fillRoundedRect(-266, -176, 532, 354, 42)
    panel.lineStyle(4, COZY.honey, 0.82)
    panel.strokeRoundedRect(-264, -174, 528, 350, 40)

    const decor = this.add.graphics()
    decor.fillStyle(COZY.sage, 1)
    decor.fillEllipse(-196, -137, 48, 20)
    decor.fillEllipse(196, -137, 48, 20)
    decor.fillStyle(COZY.honey, 1)
    decor.fillCircle(-183, -137, 7)
    decor.fillCircle(183, -137, 7)

    const title = this.add.text(0, -82, '全都配对啦！', {
      fontFamily: FONT,
      fontSize: '37px',
      color: '#285c50',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const replay = this.makeResultButton(0, 8, '再玩一次', () => {
      overlay.destroy(true)
      this.resultOverlay = undefined
      this.restart()
    }, true)

    const home = this.makeResultButton(0, 82, '回游戏屋', () => this.exitGame(), false)

    card.add([shadow, panel, decor, title, replay, home])
    card.setScale(0.92)
    overlay.add([shade, card])
    overlay.setAlpha(0)

    this.tweens.add({ targets: overlay, alpha: 1, duration: 170 })
    this.tweens.add({ targets: card, scale: 1, duration: 280, ease: 'Back.Out' })
    this.resultOverlay = overlay
  }

  private makeResultButton(
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
      fontSize: '21px',
      color: primary ? '#fffdf6' : '#285c50',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const paint = (pressed = false): void => {
      shadow.clear()
      shadow.fillStyle(COZY.cocoa, 0.22)
      shadow.fillRoundedRect(-154, -28 + 7, 308, 58, 22)
      face.clear()
      face.fillStyle(
        primary ? (pressed ? COZY.forestDark : COZY.forest) : (pressed ? 0xeadfbe : COZY.cream),
        1
      )
      face.fillRoundedRect(-154, -30 + (pressed ? 4 : 0), 308, 58, 22)
      face.lineStyle(2, primary ? 0xffffff : COZY.honey, primary ? 0.12 : 0.70)
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
        this.playLocal(MATCH_SFX.ui, 0.23)
        action()
      })
      .on('pointerout', () => { paint(false); button.setScale(1) })
    return button
  }
}
