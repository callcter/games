import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { PuzzleScene } from '../puzzle-kit/scene'
import { recordRun } from '../puzzle-kit/progress'
import { crossedEdges, move, newGame, won, type UntangleState } from './core/game'
export class UntangleScene extends PuzzleScene {
  private count = 5
  private state = newGame()
  private history: UntangleState[] = []
  private lines!: Phaser.GameObjects.Graphics
  private dragStart: UntangleState | null = null
  private assisted = false
  constructor(audio: GameAudio, exit: () => void) { super('untangle', '解绳结', audio, exit) }
  protected start(): void {
    this.input.on('dragstart', (_p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      if (won(this.state)) return
      this.dragStart = this.state; object.setScale(1.1)
    })
    this.input.on('drag', (_p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container, x: number, y: number) => {
      if (!this.dragStart) return
      const index = Number(object.getData('node'))
      this.state = { ...move(this.state, index, {x,y}), moves: this.dragStart.moves + 1 }
      const point = this.state.points[index]!
      object.setPosition(point.x, point.y); this.renderLines()
    })
    this.input.on('dragend', (_p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      object.setScale(1)
      if (!this.dragStart) return
      this.history.push(this.dragStart); this.dragStart = null
      this.audio.playMove()
      if (won(this.state)) this.complete()
    })
    this.draw()
  }
  private draw(): void {
    this.resetView('拖动圆点，把红色交叉线分开')
    ;[5,6,7,8,9].forEach((count,i) => this.button(116 + i*134,165,`${this.count === count ? '✓ ' : ''}${count} 个点`, () => { this.count = count; this.restart() },126,this.content))
    this.lines = this.add.graphics(); this.content.add(this.lines)
    this.state.points.forEach((point,index) => {
      const node = this.add.container(point.x,point.y); this.content.add(node)
      const circle = this.add.circle(0,0,29,0xfffdf6).setStrokeStyle(4,0x58a897)
      node.add(circle); this.text(0,0,String(index+1),24,node)
      node.setData('node',index).setSize(64,64).setInteractive({useHandCursor:true})
      this.input.setDraggable(node)
    })
    this.renderLines()
    this.button(160,850,'撤销',() => { this.state = this.history.pop() ?? this.state; this.draw() },180,this.content)
    this.button(384,850,'提示位置',() => {
      const i = this.state.points.findIndex((p,i) => Math.hypot(p.x-this.state.target[i]!.x,p.y-this.state.target[i]!.y) > 2)
      if (i < 0) return
      this.assisted = true
      this.history.push(this.state); this.state = move(this.state,i,this.state.target[i]!); this.draw()
      this.say(`已把 ${i+1} 号点放到一个参考位置`)
      if (won(this.state)) this.complete()
    },180,this.content)
    this.button(608,850,'新绳结',() => this.restart(),180,this.content)
  }
  private renderLines(): void {
    const crossed = crossedEdges(this.state)
    this.lines.clear()
    this.state.edges.forEach(([a,b],index) => {
      this.lines.lineStyle(5,crossed.has(index)?0xe88065:0x58a897)
      this.lines.lineBetween(this.state.points[a]!.x,this.state.points[a]!.y,this.state.points[b]!.x,this.state.points[b]!.y)
    })
    this.say(`拖动圆点分开绳子 · ${crossed.size} 条交叉线 · ${this.state.moves} 次移动`)
  }
  private complete(): void { this.celebrate(this.assisted ? '提示练习完成啦！' : '独立解开啦！'); recordRun(`untangle-${this.count}`, this.state.moves, this.assisted) }
  private restart(): void { this.assisted = false; this.state = newGame(this.count); this.history = []; this.draw() }
}
