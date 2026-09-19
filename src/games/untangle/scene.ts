import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordRun } from '../puzzle-kit/progress'
import { crossedEdges, move, newGame, won, type UntangleState } from './core/game'
import { untangleLayout, untangleToCore, untangleToDisplay } from './layout'
export class UntangleScene extends PuzzleScene {
  protected override useResponsivePlayArea = true
  private count = 6
  private state = newGame(6)
  private history: UntangleState[] = []
  private lines!: Phaser.GameObjects.Graphics
  private dragStart: UntangleState | null = null
  private dragOffset: { x: number; y: number } | null = null
  private assisted = false
  constructor(audio: GameAudio, exit: () => void) { super('untangle', '解绳结', audio, exit) }
  protected override onPlayAreaResize(): void { this.draw() }
  private currentLayout() {
    return untangleLayout(this.playArea({ bottom: 78, horizontalPadding: 40 }))
  }
  protected start(): void {
    this.input.on('dragstart', (p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      if (won(this.state)) return
      this.dragStart = this.state
      const index = Number(object.getData('node'))
      const layout = this.currentLayout()
      const pointerCore = untangleToCore(layout, this.legacyPoint(p))
      const point = this.state.points[index]!
      this.dragOffset = { x: point.x - pointerCore.x, y: point.y - pointerCore.y }
      object.setScale(layout.scale * 1.1)
    })
    this.input.on('drag', (p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      if (!this.dragStart || !this.dragOffset) return
      const index = Number(object.getData('node'))
      const layout = this.currentLayout()
      const pointerCore = untangleToCore(layout, this.legacyPoint(p))
      this.state = {
        ...move(this.state, index, {
          x: pointerCore.x + this.dragOffset.x,
          y: pointerCore.y + this.dragOffset.y
        }),
        moves: this.dragStart.moves + 1
      }
      const point = this.state.points[index]!
      const display = untangleToDisplay(layout, point)
      object.setPosition(display.x, display.y); this.renderLines()
    })
    this.input.on('dragend', (_p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      object.setScale(this.currentLayout().scale)
      if (!this.dragStart) return
      this.history.push(this.dragStart); this.dragStart = null; this.dragOffset = null
      this.audio.playMove()
      if (won(this.state)) this.complete()
    })
    this.draw()
  }
  private draw(): void {
    this.resetView('拖动圆点，把红色交叉线分开')
    this.dragStart = null
    this.dragOffset = null
    const layout = this.currentLayout()
    ;[6,7,8,9].forEach((count,i) => this.button(129 + i*170,layout.modeY,`${this.count === count ? '✓ ' : ''}${count} 个点`, () => { this.count = count; this.restart() },155,this.content))
    this.lines = this.add.graphics(); this.content.add(this.lines)
    this.state.points.forEach((point,index) => {
      const display = untangleToDisplay(layout, point)
      const node = this.add.container(display.x,display.y).setScale(layout.scale); this.content.add(node)
      const shadow = this.add.circle(0,6,33,0x684a34,0.16)
      const rim = this.add.circle(0,2,32,0xe7b45e,1)
      const circle = this.add.circle(0,-1,28,0xfffff4).setStrokeStyle(2,0xffffff,0.74)
      const shine = this.add.circle(-8,-10,7,0xffffff,0.52)
      node.add([shadow,rim,circle,shine]); this.text(0,-1,String(index+1),22,node)
      node.setData('node',index).setSize(74,74).setInteractive({useHandCursor:true})
      this.input.setDraggable(node)
    })
    this.renderLines()
    this.button(160,layout.footerY,'撤销',() => { this.state = this.history.pop() ?? this.state; this.draw() },180,this.content)
    this.button(384,layout.footerY,'提示位置',() => {
      const i = this.state.points.findIndex((p,i) => Math.hypot(p.x-this.state.target[i]!.x,p.y-this.state.target[i]!.y) > 2)
      if (i < 0) return
      this.assisted = true
      this.history.push(this.state); this.state = move(this.state,i,this.state.target[i]!); this.draw()
      this.say(`已把 ${i+1} 号点放到一个参考位置`)
      if (won(this.state)) this.complete()
    },180,this.content)
    this.button(608,layout.footerY,'新绳结',() => this.restart(),180,this.content)
  }
  private renderLines(): void {
    const crossed = crossedEdges(this.state)
    const layout = this.currentLayout()
    const point = (index: number) => untangleToDisplay(layout, this.state.points[index]!)
    this.lines.clear()
    this.state.edges.forEach(([a,b]) => {
      const pa = point(a), pb = point(b)
      this.lines.lineStyle(9*layout.scale,0x684a34,0.11)
      this.lines.lineBetween(
        pa.x+2*layout.scale,pa.y+4*layout.scale,
        pb.x+2*layout.scale,pb.y+4*layout.scale
      )
    })
    this.state.edges.forEach(([a,b],index) => {
      const pa = point(a), pb = point(b)
      this.lines.lineStyle(6*layout.scale,crossed.has(index)?0xe8755f:0x58a897)
      this.lines.lineBetween(pa.x,pa.y,pb.x,pb.y)
      this.lines.lineStyle(2*layout.scale,0xffffff,crossed.has(index)?0.18:0.28)
      this.lines.lineBetween(pa.x,pa.y-layout.scale,pb.x,pb.y-layout.scale)
    })
    this.say(`拖动圆点分开绳子 · ${crossed.size} 条交叉线 · ${this.state.moves} 次移动`)
  }
  private complete(): void { this.celebrate(this.assisted ? '提示练习完成啦！' : '独立解开啦！'); recordRun(`untangle-${this.count}`, this.state.moves, this.assisted) }
  private restart(): void { this.assisted = false; this.state = newGame(this.count); this.history = []; this.draw() }
}
