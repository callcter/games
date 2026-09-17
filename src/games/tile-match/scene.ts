import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordFlag } from '../puzzle-kit/progress'
import { isStuck, MODES, newMatch, pick, pickable, shuffle, SLOT_SIZE, undo, type MatchState } from './core/game'

// 图案与游戏主题一致：水果 emoji，前若干种按难度取用。
const EMOJIS = ['🍎', '🍌', '🍇', '🍉', '🍊', '🍓', '🍒', '🥝', '🍍', '🥭']
const TILE = 86, SPACING = 88

export class TileMatchScene extends PuzzleScene {
  private mode = 0
  private state = newMatch(0)
  private busy = false

  constructor(audio: GameAudio, exit: () => void) { super('tile-match', '叠叠消', audio, exit) }

  protected start(): void { this.draw() }

  private restart(): void {
    this.state = newMatch(this.mode)
    this.draw()
  }

  private draw(keepStatus = false): void {
    if (!keepStatus) {
      const remaining = this.state.tiles.length - this.state.gone.length
      this.resetView(`点亮着的方块，三个一样的会消除 · 剩 ${remaining} 张 · 消了 ${this.state.cleared} 组`)
    }
    this.busy = false
    MODES.forEach((entry, index) => this.button(160 + 224 * index, 165, `${this.mode === index ? '✓ ' : ''}${entry.label}`, () => {
      if (index === this.mode) return
      this.mode = index; this.restart()
    }, 190, this.content))

    // 堆叠区约束在难度按钮（底 195）与槽位（顶 726）之间的安全带内并垂直居中，
    // 层数越多的难度偏移越大，必须夹住上界避免压到按钮。
    const maxX = Math.max(...this.state.tiles.map(tile => tile.gx + tile.layer * 0.34))
    const maxY = Math.max(...this.state.tiles.map(tile => tile.gy + tile.layer * 0.34))
    const left = 384 - (maxX * SPACING + TILE) / 2
    const top = Math.max(210, 210 + (516 - (maxY * SPACING + TILE)) / 2)
    const screen = (tile: MatchState['tiles'][number]): [number, number] =>
      [left + (tile.gx + tile.layer * 0.34) * SPACING + TILE / 2, top + (tile.gy + tile.layer * 0.34) * SPACING + TILE / 2]

    const available = new Set(pickable(this.state))
    const gone = new Set(this.state.gone)
    // 深层先画、浅层覆盖在上
    ;[...this.state.tiles].sort((a, b) => a.layer - b.layer).forEach(tile => {
      if (gone.has(tile.id)) return
      const [x, y] = screen(tile)
      const free = available.has(tile.id)
      const block = this.add.container(x, y)
      this.content.add(block)
      const body = this.add.graphics()
      body.fillStyle(free ? 0xfffdf6 : 0xe6ddc9, 1)
      body.fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 16)
      body.lineStyle(3, tile.layer ? 0xb9ac93 : 0xd8cdbb)
      body.strokeRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 16)
      if (!free) { // 被压住的加一层阴影示意
        body.fillStyle(0x8a7f6a, 0.28)
        body.fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 16)
      }
      block.add(body)
      const face = this.add.text(0, 0, EMOJIS[tile.kind] ?? '?', { fontSize: '44px' }).setOrigin(0.5)
      face.setAlpha(free ? 1 : 0.45)
      block.add(face)
      block.setScale(1 - tile.layer * 0.03)
      if (free) {
        const hit = this.add.rectangle(x, y, TILE + 4, TILE + 4, 0xffffff, 0.001)
        this.content.add(hit)
        hit.setInteractive({ useHandCursor: true })
        hit.on('pointerdown', () => this.take(tile.id, [x, y]))
      }
    })

    // 槽位：拾取顺序排列，空格画底
    for (let index = 0; index < SLOT_SIZE; index++) {
      const x = 384 + (index - (SLOT_SIZE - 1) / 2) * 78
      const base = this.add.graphics()
      base.fillStyle(0xefe7d5, 1)
      base.fillRoundedRect(x - 34, 726, 68, 68, 14)
      base.lineStyle(2, 0xd8cdbb)
      base.strokeRoundedRect(x - 34, 726, 68, 68, 14)
      this.content.add(base)
      const id = this.state.slot[index]
      if (id === undefined) continue
      const tile = this.state.tiles.find(entry => entry.id === id)!
      const face = this.add.text(x, 760, EMOJIS[tile.kind] ?? '?', { fontSize: '38px' }).setOrigin(0.5)
      this.content.add(face)
    }

    this.button(160, 850, `撤销 ${this.state.undos}`, () => {
      const restored = undo(this.state)
      if (!restored) return
      this.state = restored
      this.audio.playMove()
      this.draw()
    }, 180, this.content)
    this.button(384, 850, `洗牌 ${this.state.shuffles}`, () => {
      const shuffled = shuffle(this.state)
      if (!shuffled) { this.say('洗牌次数用完啦，试试撤销几步吧'); return }
      this.state = shuffled
      this.audio.playPop(2)
      this.draw()
    }, 180, this.content)
    this.button(608, 850, '再来一局', () => this.restart(), 180, this.content)

    if (isStuck(this.state)) {
      const tip = this.add.text(384, 690, '槽满啦！撤销几步或洗一次牌吧', { fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: '21px', color: '#c0392b', fontStyle: 'bold' }).setOrigin(0.5)
      this.content.add(tip)
    }
  }

  /** 拾取：飞行动画进槽后应用规则；凑三消除时槽位闪光。 */
  private take(tileId: number, from: [number, number]): void {
    if (this.busy) return
    const result = pick(this.state, tileId)
    if (!result) return
    this.busy = true
    const immediate = result.cleared.includes(tileId)
    const slotIndex = immediate ? Math.floor(SLOT_SIZE / 2) : result.state.slot.length - 1
    const targetX = 384 + (slotIndex - (SLOT_SIZE - 1) / 2) * 78
    const kind = this.state.tiles.find(tile => tile.id === tileId)!.kind
    this.state = result.state
    this.audio.playPop(1)
    const flying = this.add.text(from[0], from[1], EMOJIS[kind] ?? '?', { fontSize: '44px' }).setOrigin(0.5)
    this.content.add(flying)
    this.tweens.add({ targets: flying, x: targetX, y: 760, scale: 0.9, duration: 190, ease: 'Cubic.Out', onComplete: () => {
      flying.destroy()
      if (result.cleared.length) {
        this.audio.playWin()
        this.sprayStars(targetX, 760)
      }
      this.draw()
      if (this.state.won) {
        recordFlag('tile-match-clear')
        this.celebrate('全部消完啦！')
      }
    } })
  }

  private sprayStars(x: number, y: number): void {
    for (let index = 0; index < 6; index++) {
      const star = this.add.text(x, y, '✦', { fontSize: '20px', color: '#e6b84d', fontStyle: 'bold' }).setOrigin(0.5)
      this.content.add(star)
      const angle = index / 6 * Math.PI * 2
      this.tweens.add({ targets: star, x: x + Math.cos(angle) * 54, y: y + Math.sin(angle) * 54, alpha: 0, duration: 380, ease: 'Cubic.Out', onComplete: () => star.destroy() })
    }
  }
}
