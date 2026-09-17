import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { COLORS, PuzzleScene } from '../puzzle-kit/scene'
import { recordFlag } from '../puzzle-kit/progress'
import { LEVEL_NAMES, newGame, place, vertices, type TangramState } from './core/game'
export class TangramScene extends PuzzleScene {
  private state = newGame()
  private selected = 0
  private silhouette = true
  private history: TangramState[] = []
  private beforeDrag: TangramState | null = null
  constructor(audio: GameAudio, exit: () => void) { super('tangram', '七巧板', audio, exit) }
  protected start(): void {
    this.input.on('dragstart', (_p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      this.beforeDrag = this.state; this.selected = Number(object.getData('piece'))
      object.setScale(1); this.content.bringToTop(object)
      // 拿起时轻微弹一下，拼块像被手指捏起来。
      this.tweens.add({ targets: object, scale: 1.05, duration: 90, yoyo: true, ease: 'Sine.Out' })
    })
    this.input.on('drag', (_p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container, x: number, y: number) => object.setPosition(Phaser.Math.Clamp(x,80,688),Phaser.Math.Clamp(y,225,760)))
    this.input.on('dragend', (_p: Phaser.Input.Pointer, object: Phaser.GameObjects.Container) => {
      if (!this.beforeDrag) return
      const index = Number(object.getData('piece'))
      this.history.push(this.beforeDrag); this.beforeDrag = null
      this.state = place(this.state,index,{...this.state.pieces[index]!,x:object.x,y:object.y},this.silhouette)
      this.audio.playMove(); this.draw()
      if(this.state.won) this.complete()
    })
    this.draw()
  }
  private draw(): void {
    this.resetView(this.state.won ? '七块都拼好啦！' : `拖图形到${this.silhouette ? '剪影' : '同色轮廓'} · 已拼 ${this.state.pieces.filter(p=>p.placed).length} / 7 块`)
    this.text(384,153,`${LEVEL_NAMES[this.state.level]} · 点选图形后可旋转、翻面`,20,this.content)
    this.button(135,210,this.silhouette ? '✓ 剪影挑战' : '剪影挑战',()=>{this.silhouette=!this.silhouette;this.state=newGame(this.state.level);this.history=[];this.assisted=false;this.draw()},190,this.content)
    this.state.targets.forEach((target,i)=>{
      const g=this.add.graphics();this.content.add(g)
      const points=vertices(i,target).map(p=>new Phaser.Math.Vector2(p.x,p.y))
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
      const node=this.add.container(piece.x,piece.y);this.content.add(node)
      const points=vertices(i,{x:0,y:0,rotation:piece.rotation,flipped:piece.flipped}).map(p=>new Phaser.Math.Vector2(p.x,p.y))
      const g=this.add.graphics();node.add(g);g.fillStyle(COLORS[i]!);g.lineStyle(i===this.selected?4:2,0xffffff)
      g.fillPoints(points,true);g.strokePoints(points,true)
      this.text(0,0,String(i+1),22,node)
      if(!piece.placed){
        if(piece.y>=600)node.setScale(0.6)
        node.setData('piece',i).setInteractive(new Phaser.Geom.Polygon(points),
          (shape: Phaser.Geom.Polygon, x: number, y: number) => Phaser.Geom.Polygon.Contains(shape,x,y) || Math.hypot(x,y)<54)
        node.on('pointerdown',()=>{this.selected=i;this.say(`已选第 ${i+1} 块 · 可拖动、旋转或翻面`)})
        this.input.setDraggable(node)
      }
    })
    this.button(327,210,'↻ 旋转',()=>this.transform(false),160,this.content)
    this.button(491,210,'翻面',()=>this.transform(true),136,this.content)
    this.button(656,210,'提示一块',()=>{
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
    this.button(160,850,'撤销',()=>{this.state=this.history.pop()??this.state;this.draw()},180,this.content)
    this.button(384,850,'重开',()=>{this.state=newGame(this.state.level);this.history=[];this.assisted=false;this.draw()},180,this.content)
    this.button(608,850,'下一幅',()=>{this.state=newGame((this.state.level+1)%LEVEL_NAMES.length);this.history=[];this.assisted=false;this.draw()},180,this.content)
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
