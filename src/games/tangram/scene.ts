import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { COLORS, PuzzleScene } from '../puzzle-kit/scene'
import { recordFlag } from '../puzzle-kit/progress'
import { LEVEL_NAMES, newGame, place, vertices, type TangramState } from './core/game'
import { tangramLayout, tangramToCore, tangramToDisplay } from './layout'
export class TangramScene extends PuzzleScene {
  protected override useResponsivePlayArea = true
  private state = newGame()
  private selected = 0
  private silhouette = true
  private history: TangramState[] = []
  private beforeDrag: TangramState | null = null
  private dragOffset: { x: number; y: number } | null = null
  constructor(audio: GameAudio, exit: () => void) { super('tangram', '七巧板', audio, exit) }
  protected override onPlayAreaResize(): void { this.draw() }
  private currentLayout() {
    return tangramLayout(this.playArea({ bottom: 78, horizontalPadding: 40 }))
  }
  protected start(): void {
    this.input.on('dragstart', (p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      this.beforeDrag = this.state
      this.selected = Number(object.getData('piece'))
      const layout = this.currentLayout()
      const pointerCore = tangramToCore(layout, this.legacyPoint(p))
      const piece = this.state.pieces[this.selected]!
      this.dragOffset = { x: piece.x - pointerCore.x, y: piece.y - pointerCore.y }
      object.setScale(layout.scale)
      this.content.bringToTop(object)
      // 拿起时轻微弹一下，拼块像被手指捏起来。
      this.tweens.add({ targets: object, scale: layout.scale * 1.05, duration: 90, yoyo: true, ease: 'Sine.Out' })
    })
    this.input.on('drag', (p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      if (!this.beforeDrag || !this.dragOffset) return
      const layout = this.currentLayout()
      const pointerCore = tangramToCore(layout, this.legacyPoint(p))
      const core = {
        x: Phaser.Math.Clamp(pointerCore.x + this.dragOffset.x, 80, 688),
        y: Phaser.Math.Clamp(pointerCore.y + this.dragOffset.y, 225, 760)
      }
      const display = tangramToDisplay(layout, core)
      object.setPosition(display.x, display.y)
    })
    this.input.on('dragend', (_p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      if (!this.beforeDrag) return
      const index = Number(object.getData('piece'))
      const layout = this.currentLayout()
      const core = tangramToCore(layout, { x: object.x, y: object.y })
      this.history.push(this.beforeDrag)
      this.beforeDrag = null
      this.dragOffset = null
      this.state = place(this.state,index,{...this.state.pieces[index]!,x:core.x,y:core.y},this.silhouette)
      this.audio.playMove(); this.draw()
      if(this.state.won) this.complete()
    })
    this.draw()
  }
  private draw(): void {
    this.beforeDrag = null
    this.dragOffset = null
    this.resetView(this.state.won ? '七块都拼好啦！' : `拖图形到${this.silhouette ? '剪影' : '同色轮廓'} · 已拼 ${this.state.pieces.filter(p=>p.placed).length} / 7 块`)
    const layout = this.currentLayout()
    this.text(384,layout.actionY - 57,`${LEVEL_NAMES[this.state.level]} · 点选图形后可旋转、翻面`,20,this.content)
    this.button(135,layout.actionY,this.silhouette ? '✓ 剪影挑战' : '剪影挑战',()=>{this.silhouette=!this.silhouette;this.state=newGame(this.state.level);this.history=[];this.assisted=false;this.draw()},190,this.content)
    const board=this.add.graphics();this.content.add(board)
    board.fillStyle(0x684a34,0.10);board.fillRoundedRect(layout.boardX,layout.boardY + 8 * layout.scale,layout.boardWidth,layout.boardHeight,30 * layout.scale)
    board.fillStyle(0xfffff4,0.92);board.fillRoundedRect(layout.boardX,layout.boardY,layout.boardWidth,layout.boardHeight,30 * layout.scale)
    board.lineStyle(2 * layout.scale,0xe7b45e,0.42);board.strokeRoundedRect(layout.boardX + 2 * layout.scale,layout.boardY + 2 * layout.scale,layout.boardWidth - 4 * layout.scale,layout.boardHeight - 4 * layout.scale,28 * layout.scale)
    this.state.targets.forEach((target,i)=>{
      const g=this.add.graphics();this.content.add(g)
      const points=vertices(i,target).map(p=>{
        const q=tangramToDisplay(layout,p)
        return new Phaser.Math.Vector2(q.x,q.y)
      })
      if(this.silhouette){
        // 剪影挑战：整幅图案同色半透明，不给分块提示
        g.fillStyle(0x527267,0.16)
        g.fillPoints(points,true)
      }else{
        g.fillStyle(COLORS[i]!,0.13);g.lineStyle(2,COLORS[i]!,0.8)
        g.fillPoints(points,true);g.strokePoints(points,true)
      }
    })
    this.state.pieces.forEach((piece,i)=>{
      const display=tangramToDisplay(layout,piece)
      const node=this.add.container(display.x,display.y);this.content.add(node)
      const points=vertices(i,{x:0,y:0,rotation:piece.rotation,flipped:piece.flipped}).map(p=>new Phaser.Math.Vector2(p.x,p.y))
      const shadow=this.add.graphics();node.add(shadow)
      shadow.fillStyle(0x684a34,0.16)
      shadow.fillPoints(points.map(p=>new Phaser.Math.Vector2(p.x+4,p.y+6)),true)
      const g=this.add.graphics();node.add(g);g.fillStyle(COLORS[i]!);g.lineStyle(i===this.selected?5:2,0xffffff,i===this.selected?1:0.72)
      g.fillPoints(points,true);g.strokePoints(points,true)
      if(!piece.placed){
        node.setScale(layout.scale * (piece.y>=600 ? 0.72 : 1))
        node.setData('piece',i).setInteractive(new Phaser.Geom.Polygon(points),
          (shape: Phaser.Geom.Polygon, x: number, y: number) => Phaser.Geom.Polygon.Contains(shape,x,y) || Math.hypot(x,y)<54)
        node.on('pointerdown',()=>{this.selected=i;this.say(`已选第 ${i+1} 块 · 可拖动、旋转或翻面`)})
        this.input.setDraggable(node)
      } else {
        node.setScale(layout.scale)
      }
    })
    this.button(327,layout.actionY,'↻ 旋转',()=>this.transform(false),160,this.content)
    this.button(491,layout.actionY,'翻面',()=>this.transform(true),136,this.content)
    this.button(656,layout.actionY,'提示一块',()=>{
      const i=this.state.pieces.findIndex(p=>!p.placed);if(i<0)return
      this.assisted=true
      // 剪影可有不同拼法：提示回到标准拼法，保留撤销入口。
      this.history.push(this.state)
      const previous=this.state.pieces.filter(p=>p.placed).length
      this.state=newGame(this.state.level)
      for(let j=0;j<=previous;j++)this.state=place(this.state,j,this.state.targets[j]!,this.silhouette)
      this.draw();this.say('提示采用参考拼法；可以撤销恢复刚才的摆法')
      if(this.state.won)this.complete()
    },160,this.content)
    this.button(160,layout.footerY,'撤销',()=>{this.state=this.history.pop()??this.state;this.draw()},180,this.content)
    this.button(384,layout.footerY,'重开',()=>{this.state=newGame(this.state.level);this.history=[];this.assisted=false;this.draw()},180,this.content)
    this.button(608,layout.footerY,'下一幅',()=>{this.state=newGame((this.state.level+1)%LEVEL_NAMES.length);this.history=[];this.assisted=false;this.draw()},180,this.content)
  }
  private transform(reflect: boolean): void {
    const piece=this.state.pieces[this.selected]!
    if(piece.placed)return
    this.history.push(this.state)
    this.state=place(this.state,this.selected,{...piece,rotation:reflect?piece.rotation:(piece.rotation+1)%8,flipped:reflect?!piece.flipped:piece.flipped},this.silhouette)
    this.draw()
    if(this.state.won)this.complete()
  }
  private assisted=false
  private complete(): void {
    this.audio.playWin()
    recordFlag(`tangram-${this.state.level}:${this.silhouette?'silhouette':'guided'}:${this.assisted?'assisted':'solo'}`)
    this.say(this.assisted?'提示练习完成啦！':'独立拼好啦！')
  }
}
