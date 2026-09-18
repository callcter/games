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

const TILE = 86
const SPACING = 88
const SLOT_GAP = 78
const SLOT_Y = 716
const BOARD_TOP = 106
const BOARD_HEIGHT = 500
const FONT = 'Avenir Next, PingFang SC, sans-serif'

const FALLBACK = ['🍏', '🍌', '🍇', '🍉', '🍊', '🍓', '🍒', '🥝', '🍍', '🥭']
const BURST_COLORS = [0x9ccd45, 0xf2cf45, 0x8f62c8, 0xef6262, 0xf59b38, 0xef5770, 0xd6404f, 0x76bf4f, 0xe7b73d, 0xf18b35]

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

  private tileViews = new Map<number, TileView>()
  private boardPositions = new Map<number, { x: number; y: number }>()
  private available = new Set<number>()

  private trayBase!: Phaser.GameObjects.Graphics
  private modeText!: Phaser.GameObjects.Text
  private soundText!: Phaser.GameObjects.Text
  private undoText!: Phaser.GameObjects.Text
  private shuffleText!: Phaser.GameObjects.Text
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
    this.cameras.main.setBackgroundColor('#d8c4a1')
    this.useArt = matchSheetReady(this)

    if (this.textures.exists(MATCH_BG_KEY)) {
      const source = this.textures.get(MATCH_BG_KEY).source[0]
      if (source) {
        const scale = Math.max(768 / source.width, 900 / source.height)
        this.add
          .image(384, 450, MATCH_BG_KEY)
          .setDisplaySize(source.width * scale, source.height * scale)
          .setDepth(-30)
      }
      setHostBackdrop('art/tile-match-bg.png')
      const release = (): void => releaseHostBackdrop()
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, release)
      this.events.once(Phaser.Scenes.Events.DESTROY, release)
    }

    // 只做轻微暗化，保证桌面背景能看见、牌仍然清楚。
    this.add.rectangle(384, 450, 768, 900, 0x5c432d, 0.08).setDepth(-20)

    this.input.on('pointerdown', () => void this.audio.unlock())

    this.createTopControls()
    this.createTray()
    this.createBottomControls()
    this.rebuildBoard(false)
  }

  private createTopControls(): void {
    this.makeRoundButton(48, 46, '‹', () => this.exitGame(), 28)

    const sound = this.makeRoundButton(720, 46, this.audio.isMuted ? '×' : '♪', () => {
      this.audio.toggleMuted()
      this.soundText.setText(this.audio.isMuted ? '×' : '♪')
    }, 23)
    this.soundText = sound.label

    const chip = this.add.container(384, 46).setDepth(300)
    const bg = this.add.graphics()
    const paint = (pressed = false): void => {
      bg.clear()
      bg.fillStyle(0x173f35, pressed ? 0.92 : 0.82)
      bg.fillRoundedRect(-72, -25, 144, 50, 25)
    }
    paint()
    chip.add(bg)
    this.modeText = this.add.text(0, 0, `${MODES[this.mode]?.label ?? '基础'}  ›`, {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#fffdf6',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    chip.add(this.modeText)
    chip.setSize(144, 50)
    chip.setInteractive(new Phaser.Geom.Rectangle(0, 0, 144, 50), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => { paint(true); chip.setScale(0.97) })
      .on('pointerup', () => {
        paint(false)
        chip.setScale(1)
        if (this.busy) return
        this.mode = (this.mode + 1) % MODES.length
        this.modeText.setText(`${MODES[this.mode]?.label ?? '基础'}  ›`)
        this.state = newMatch(this.mode)
        this.playLocal(MATCH_SFX.shuffle, 0.28)
        this.rebuildBoard(true)
      })
      .on('pointerout', () => { paint(false); chip.setScale(1) })
  }

  private createTray(): void {
    this.trayBase = this.add.graphics().setDepth(2)
    this.paintTray(false)

    for (let index = 0; index < SLOT_SIZE; index++) {
      const x = this.slotX(index)
      const base = this.add.graphics().setDepth(3)
      base.fillStyle(0xfffbf2, 0.55)
      base.fillRoundedRect(x - 33, SLOT_Y - 33, 66, 66, 17)
      base.lineStyle(1.5, 0xffffff, 0.58)
      base.strokeRoundedRect(x - 33, SLOT_Y - 33, 66, 66, 17)
    }
  }

  private paintTray(alert: boolean): void {
    this.trayBase.clear()
    this.trayBase.fillStyle(0x2c2119, 0.12)
    this.trayBase.fillRoundedRect(72, 650, 624, 138, 31)
    this.trayBase.fillStyle(alert ? 0xffeee6 : 0xfff9ea, 0.91)
    this.trayBase.fillRoundedRect(76, 646, 616, 136, 30)
    this.trayBase.lineStyle(alert ? 3 : 2, alert ? 0xe88065 : 0xffffff, alert ? 0.9 : 0.65)
    this.trayBase.strokeRoundedRect(76, 646, 616, 136, 30)
  }

  private createBottomControls(): void {
    const undoButton = this.makeRoundButton(284, 842, '↶', () => this.undoMove(), 27, 30)
    this.undoText = this.add.text(307, 858, '', {
      fontFamily: FONT, fontSize: '14px', color: '#173f35', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(305)

    const shuffleButton = this.makeRoundButton(384, 842, '⌁', () => this.shuffleBoard(), 27, 30)
    this.shuffleText = this.add.text(407, 858, '', {
      fontFamily: FONT, fontSize: '14px', color: '#173f35', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(305)

    this.makeRoundButton(484, 842, '↻', () => this.restart(), 27, 30)

    undoButton.container.setDepth(300)
    shuffleButton.container.setDepth(300)
    this.refreshControls()
  }

  private makeRoundButton(
    x: number,
    y: number,
    glyph: string,
    action: () => void,
    fontSize = 26,
    radius = 32
  ): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const container = this.add.container(x, y).setDepth(300)
    const bg = this.add.graphics()
    const paint = (pressed = false): void => {
      bg.clear()
      bg.fillStyle(0x2c2119, 0.13)
      bg.fillCircle(0, 4, radius)
      bg.fillStyle(pressed ? 0xe9f0e8 : 0xfffdf6, 0.96)
      bg.fillCircle(0, 0, radius)
      bg.lineStyle(1.5, 0xffffff, 0.8)
      bg.strokeCircle(0, 0, radius)
    }
    paint()
    const label = this.add.text(0, -1, glyph, {
      fontFamily: FONT,
      fontSize: `${fontSize}px`,
      color: '#173f35',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    container.add([bg, label])
    container.setSize(radius * 2, radius * 2)
    container
      .setInteractive(new Phaser.Geom.Circle(radius, radius, radius), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => { paint(true); container.setScale(0.91) })
      .on('pointerup', () => {
        paint(false)
        this.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Back.Out' })
        action()
      })
      .on('pointerout', () => { paint(false); container.setScale(1) })
    return { container, label }
  }

  private restart(): void {
    if (this.busy) return
    this.state = newMatch(this.mode)
    this.playLocal(MATCH_SFX.shuffle, 0.22)
    this.rebuildBoard(true)
  }

  private undoMove(): void {
    if (this.busy) return
    const restored = undo(this.state)
    if (!restored) {
      this.showToast(this.state.undos <= 0 ? '撤销次数用完啦' : '还没有可以撤销的牌')
      return
    }
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
   * 低频操作（重开/撤销/洗牌）允许重建；
   * 主玩法 take() 路径绝不调用这里。
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
      .filter(tile => !gone.has(tile.id))
      .sort((a, b) => a.layer - b.layer)

    for (const tile of boardTiles) {
      const pos = this.boardPositions.get(tile.id)
      if (!pos) continue
      const view = this.createTileView(tile, pos.x, pos.y, 'board')
      this.tileViews.set(tile.id, view)
      this.setTileFree(view, this.available.has(tile.id), false)
      if (animated) {
        const target = view.baseScale
        view.container.setScale(target * 0.88).setAlpha(0)
        this.tweens.add({
          targets: view.container,
          scale: target,
          alpha: 1,
          duration: 180 + tile.layer * 22,
          ease: 'Back.Out'
        })
      }
    }

    this.state.slot.forEach((id, index) => {
      const tile = this.state.tiles.find(entry => entry.id === id)
      if (!tile) return
      const view = this.createTileView(tile, this.slotX(index), SLOT_Y, 'slot')
      view.container.setScale(0.74)
      view.container.disableInteractive()
      this.tileViews.set(id, view)
    })

    this.refreshControls()
    this.refreshStuckState()
  }

  private computeBoardPositions(): void {
    this.boardPositions.clear()
    const maxX = Math.max(...this.state.tiles.map(tile => tile.gx + tile.layer * 0.34))
    const maxY = Math.max(...this.state.tiles.map(tile => tile.gy + tile.layer * 0.34))
    const boardWidth = maxX * SPACING + TILE
    const boardHeight = maxY * SPACING + TILE
    const left = 384 - boardWidth / 2
    const top = Math.max(BOARD_TOP, BOARD_TOP + (BOARD_HEIGHT - boardHeight) / 2)

    for (const tile of this.state.tiles) {
      this.boardPositions.set(tile.id, {
        x: left + (tile.gx + tile.layer * 0.34) * SPACING + TILE / 2,
        y: top + (tile.gy + tile.layer * 0.34) * SPACING + TILE / 2
      })
    }
  }

  private createTileView(tile: Tile, x: number, y: number, location: 'board' | 'slot'): TileView {
    const container = this.add.container(x, y).setDepth(10 + tile.layer)
    const body = this.add.graphics()
    container.add(body)

    const frame = this.useArt ? TILE_KIND_FRAME[tile.kind] ?? -1 : -1
    let face: Phaser.GameObjects.Image | Phaser.GameObjects.Text
    if (frame >= 0) {
      face = this.add.image(0, -2, MATCH_SHEET_KEY, frame).setDisplaySize(TILE * 0.69, TILE * 0.69)
    } else {
      face = this.add.text(0, -1, FALLBACK[tile.kind] ?? '?', {
        fontSize: '43px'
      }).setOrigin(0.5)
    }
    container.add(face)

    const baseScale = location === 'board' ? 1 - tile.layer * 0.025 : 0.74
    container.setScale(baseScale)
    container.setSize(TILE, TILE)
    container
      .setInteractive(
        // Phaser 4 Container 的 displayOrigin = size/2：hitArea 以左上角为原点。
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

    // 厚玩具牌：下沿阴影 + 温暖象牙色本体。
    g.fillStyle(0x4b3829, free ? 0.18 : 0.11)
    g.fillRoundedRect(-TILE / 2, -TILE / 2 + 5, TILE, TILE, 18)
    g.fillStyle(free ? 0xfffcf3 : 0xe3dac8, 0.98)
    g.fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 18)
    g.lineStyle(2.2, free ? 0xffffff : 0xb8ac98, free ? 0.92 : 0.55)
    g.strokeRoundedRect(-TILE / 2 + 1, -TILE / 2 + 1, TILE - 2, TILE - 2, 17)

    if (!free && view.location === 'board') {
      g.fillStyle(0x4f4438, 0.19)
      g.fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 18)
    }

    view.face.setAlpha(free ? 1 : 0.42)
  }

  private setTileFree(view: TileView, free: boolean, animateNew: boolean): void {
    const wasFree = view.free
    this.paintTile(view, free)

    if (view.location !== 'board') return
    if (view.container.input) view.container.input.enabled = free && !isStuck(this.state)

    if (free && !wasFree && animateNew) {
      const target = view.baseScale
      view.container.setScale(target * 0.93)
      this.tweens.add({
        targets: view.container,
        scale: target * 1.045,
        duration: 115,
        ease: 'Sine.Out',
        yoyo: true,
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
    this.children.bringToTop(view.container)

    this.playLocal(MATCH_SFX.pick, 0.38)

    this.tweens.add({
      targets: view.container,
      x: targetX,
      y: SLOT_Y,
      angle: 0,
      scale: 0.74,
      duration: 215,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.state = result.state
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
    this.burstMatch(this.slotX(Math.min(this.state.slot.length, SLOT_SIZE - 1)), SLOT_Y, kind)

    // 先“碰”一下，再三张一起 pop；这三张就是原来的 TileView，不创建替身。
    this.tweens.add({
      targets: views.map(view => view.container),
      y: SLOT_Y - 8,
      scale: 0.82,
      duration: 90,
      ease: 'Sine.Out',
      onComplete: () => {
        this.tweens.add({
          targets: views.map(view => view.container),
          scale: 1.02,
          alpha: 0,
          y: SLOT_Y - 20,
          duration: 170,
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
      this.tweens.add({
        targets: view.container,
        x: this.slotX(index),
        y: SLOT_Y,
        scale: 0.74,
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
        targets: this.trayBase,
        alpha: { from: 0.68, to: 1 },
        duration: 180,
        yoyo: true,
        repeat: 1
      })
    }
  }

  private refreshControls(): void {
    this.undoText.setText(String(this.state.undos))
    this.shuffleText.setText(String(this.state.shuffles))
  }

  private slotX(index: number): number {
    return 384 + (index - (SLOT_SIZE - 1) / 2) * SLOT_GAP
  }

  private playLocal(key: string, volume: number): void {
    if (this.audio.isMuted || !this.cache.audio.exists(key)) return
    try {
      this.sound.play(key, { volume })
    } catch {
      // Phaser/WebAudio 在个别浏览器还未 unlock 时静默失败即可；
      // 下一次用户手势会正常播放，不阻断游戏。
    }
  }

  private burstMatch(x: number, y: number, kind: number): void {
    const color = BURST_COLORS[kind] ?? 0xf2c94c
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + 0.2
      const distance = 42 + (i % 3) * 10
      const dot = this.add.circle(x, y, i % 2 ? 6 : 4, color, 0.95).setDepth(220)
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: 330,
        ease: 'Cubic.Out',
        onComplete: () => dot.destroy()
      })
    }
  }

  private showToast(message: string): void {
    this.hideToast()
    const toast = this.add.container(384, 620).setDepth(260)
    const bg = this.add.graphics()
    bg.fillStyle(0x173f35, 0.90)
    bg.fillRoundedRect(-170, -27, 340, 54, 27)
    const text = this.add.text(0, 0, message, {
      fontFamily: FONT,
      fontSize: '18px',
      color: '#fffdf6',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    toast.add([bg, text])
    toast.setScale(0.92).setAlpha(0)
    this.tweens.add({ targets: toast, scale: 1, alpha: 1, duration: 150, ease: 'Back.Out' })
    this.toast = toast

    if (!isStuck(this.state)) {
      this.time.delayedCall(1500, () => {
        if (this.toast !== toast) return
        this.tweens.add({
          targets: toast,
          alpha: 0,
          y: 612,
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

    const overlay = this.add.container(0, 0).setDepth(500)
    const shade = this.add.rectangle(384, 450, 768, 900, 0x173f35, 0.30)
      .setInteractive()
    const panel = this.add.graphics()
    panel.fillStyle(0x2b2119, 0.16)
    panel.fillRoundedRect(126, 294, 524, 330, 38)
    panel.fillStyle(0xfffdf6, 0.985)
    panel.fillRoundedRect(122, 288, 524, 330, 38)

    const sparkle = this.add.text(384, 355, '✦  ✦  ✦', {
      fontFamily: FONT,
      fontSize: '28px',
      color: '#e0ad36',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const title = this.add.text(384, 420, '全都配对啦！', {
      fontFamily: FONT,
      fontSize: '36px',
      color: '#173f35',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    const replay = this.makeOverlayButton(384, 510, '再玩一次', () => {
      overlay.destroy(true)
      this.resultOverlay = undefined
      this.restart()
    }, true)

    const home = this.makeOverlayButton(384, 578, '回游戏屋', () => this.exitGame(), false)

    overlay.add([shade, panel, sparkle, title, replay, home])
    overlay.setAlpha(0)
    panel.setScale(0.94)

    this.tweens.add({ targets: overlay, alpha: 1, duration: 180 })
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: 'Back.Out' })
    this.resultOverlay = overlay
  }

  private makeOverlayButton(
    x: number,
    y: number,
    label: string,
    action: () => void,
    primary: boolean
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y)
    const bg = this.add.graphics()
    const paint = (pressed = false): void => {
      bg.clear()
      bg.fillStyle(primary ? (pressed ? 0x245f50 : 0x2f7865) : (pressed ? 0xe6e0d3 : 0xf5f0e4), 1)
      bg.fillRoundedRect(-145, -28, 290, 56, 19)
    }
    paint()
    const text = this.add.text(0, 0, label, {
      fontFamily: FONT,
      fontSize: '21px',
      color: primary ? '#fffdf6' : '#173f35',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    button.add([bg, text])
    button.setSize(290, 56)
    button.setInteractive(new Phaser.Geom.Rectangle(0, 0, 290, 56), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => { paint(true); button.setScale(0.97) })
      .on('pointerup', () => { paint(false); button.setScale(1); action() })
      .on('pointerout', () => { paint(false); button.setScale(1) })
    return button
  }
}
