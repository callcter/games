import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordRun } from '../puzzle-kit/progress'
import { DIRECTIONS, neighbor } from '../pipes/core/game'
import { dragAlong, move, newGame, path, undo, type MazeState } from './core/game'
export class MazeScene extends PuzzleScene {
  private size = 7
  private state = newGame(7)
  private hint = -1
  private assisted = false
  private shortest = path(this.state).length - 1
  private dragPoint: { x: number; y: number } | null = null
  private rabbit!: Phaser.GameObjects.Text
  private tiles: Phaser.GameObjects.Rectangle[] = []
  constructor(audio: GameAudio, exit: () => void) { super('maze', '迷宫探险', audio, exit) }
  protected start(): void {
    const gridPoint = (p: Phaser.Input.Pointer) => ({ x: (p.x-134)/(500/this.size), y: (p.y-230)/(500/this.size) })
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragPoint = null
      const point=gridPoint(p)
      if (point.x<0 || point.y<0 || point.x>=this.size || point.y>=this.size || this.state.won) return
      const target=Math.floor(point.y)*this.size+Math.floor(point.x)
      const d=[0,1,2,3].find(d=>neighbor(this.state.player,d,this.size)===target)
      if (d!==undefined) this.step(d)
      if (this.state.player===target) this.dragPoint=point
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.dragPoint) return
      const point=gridPoint(p), from=this.dragPoint
      if (point.x<0 || point.y<0 || point.x>=this.size || point.y>=this.size) { this.dragPoint=null; return }
      this.applyMove(dragAlong(this.state,from.x,from.y,point.x,point.y))
      this.dragPoint=point
    })
    for (const event of ['pointerup','pointerupoutside','gameout']) this.input.on(event,()=>{this.dragPoint=null})
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const d = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(event.key)
      if (d >= 0) { event.preventDefault(); this.step(d) }
    })
    this.draw()
  }
  private step(d: number): void {
    this.applyMove(move(this.state,d))
  }
  private applyMove(next: MazeState): void {
    if (next === this.state) return
    this.state = next; this.hint = -1; this.audio.playMove(); this.refreshPlayer()
    if (next.won) { this.celebrate(this.assisted ? '提示练习：小兔子到家啦！' : '小兔子独立到家啦！'); recordRun(`maze-${this.size}`, Math.max(0, next.trail.length - this.shortest), this.assisted) }
  }
  private draw(): void {
    this.dragPoint=null
    this.tiles=[]
    this.resetView('')
    ;[7, 9, 11].forEach((size, i) => this.button(160 + 224 * i, 165, `${this.size === size ? '✓ ' : ''}${size} × ${size}`, () => { this.size = size; this.restart() }, 190, this.content))
    const cell = 500 / this.size, left = 134, top = 230
    this.state.passages.forEach((mask, i) => {
      const x = left + i % this.size * cell, y = top + Math.floor(i / this.size) * cell
      const tile = this.add.rectangle(x + cell / 2, y + cell / 2, cell, cell, i === this.hint ? 0xffd982 : 0xfffdf6)
      this.content.add(tile)
      this.tiles.push(tile)
      const g = this.add.graphics(); this.content.add(g); g.lineStyle(4, 0x527267)
      if (!(mask & DIRECTIONS[0])) g.lineBetween(x, y, x + cell, y)
      if (!(mask & DIRECTIONS[1])) g.lineBetween(x + cell, y, x + cell, y + cell)
      if (!(mask & DIRECTIONS[2])) g.lineBetween(x, y + cell, x + cell, y + cell)
      if (!(mask & DIRECTIONS[3])) g.lineBetween(x, y, x, y + cell)
      if (i === this.size * this.size - 1) this.text(x + cell / 2, y + cell / 2, '🏠', cell * 0.58, this.content)
    })
    this.rabbit=this.text(0,0,'🐰',cell*0.58,this.content)
    this.refreshPlayer()
    ;['↑', '→', '↓', '←'].forEach((label, d) => this.button(222 + d * 108, 775, label, () => this.step(d), 96, this.content))
    this.button(160, 850, '撤销', () => { this.state = undo(this.state); this.draw() }, 180, this.content)
    this.button(384, 850, '提示一步', () => { this.assisted = true; this.hint = path(this.state)[1] ?? -1; this.draw() }, 180, this.content)
    this.button(608, 850, '新迷宫', () => this.restart(), 180, this.content)
  }
  private refreshPlayer(): void {
    const cell=500/this.size
    this.rabbit.setPosition(134+(this.state.player%this.size+0.5)*cell,230+(Math.floor(this.state.player/this.size)+0.5)*cell)
    this.tiles.forEach((tile,index)=>tile.setFillStyle(index===this.hint ? 0xffd982 : this.state.trail.includes(index) ? 0xe0eddf : 0xfffdf6))
    this.say(`按住小兔子沿路拖动，也能点相邻格 · ${this.state.trail.length} 步`)
  }
  private restart(): void { this.assisted = false; this.state = newGame(this.size); this.shortest = path(this.state).length - 1; this.hint = -1; this.draw() }
}
