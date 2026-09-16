import Phaser from 'phaser'
import type { GameAudio } from '../../platform/audio/game-audio'
import { COLORS, PuzzleScene } from '../puzzle-kit/scene'
import { LEFT, newGame, position, RADIUS, RIGHT, settle, SHOOTER, trace, type BubbleState } from './core/game'
const SYMBOLS=['●','★','♥']
export class BubblesScene extends PuzzleScene {
  private state = newGame()
  private angle = 0
  private shooting = false
  private aiming = false
  private guide!: Phaser.GameObjects.Graphics
  private history: BubbleState[] = []
  constructor(audio: GameAudio, exit: () => void) { super('bubbles','泡泡龙',audio,exit) }
  protected start(): void {
    this.input.on('pointerdown',(pointer: Phaser.Input.Pointer)=>{
      if(pointer.y<225||pointer.y>785||pointer.x<LEFT-24||pointer.x>RIGHT+24||this.shooting||this.state.status!=='playing')return
      this.aiming=true;this.aim(pointer)
    })
    this.input.on('pointermove',(pointer: Phaser.Input.Pointer)=>{if(this.aiming)this.aim(pointer)})
    this.input.on('pointerup',()=>{if(this.aiming){this.aiming=false;this.fire()}})
    this.input.on('gameout',()=>{this.aiming=false})
    this.input.keyboard?.on('keydown',(event: KeyboardEvent)=>{
      if(this.shooting||this.state.status!=='playing')return
      if(event.key==='ArrowLeft')this.angle=Math.max(-1.2,this.angle-0.06)
      else if(event.key==='ArrowRight')this.angle=Math.min(1.2,this.angle+0.06)
      else if(event.key===' '){event.preventDefault();this.fire();return}
      else return
      event.preventDefault();this.drawGuide()
    })
    this.draw()
  }
  private aim(pointer: Phaser.Input.Pointer): void {
    this.angle=Phaser.Math.Clamp(Math.atan2(pointer.x-SHOOTER.x,Math.max(35,SHOOTER.y-pointer.y)),-1.2,1.2)
    this.drawGuide()
  }
  private bubble(x: number,y: number,color: number,parent=this.content): Phaser.GameObjects.Container {
    const node=this.add.container(x,y);parent.add(node)
    node.add(this.add.circle(0,0,RADIUS,COLORS[color]!).setStrokeStyle(3,0xffffff))
    this.text(0,0,SYMBOLS[color]!,22,node).setColor('#ffffff')
    return node
  }
  private draw(): void {
    this.resetView(`得分 ${this.state.score} · 发射 ${this.state.shots} 次 · 同色 3 个一起消除`)
    this.text(384,153,'按住拖动瞄准，松开发射 · 不限时',22,this.content)
    const walls=this.add.graphics();this.content.add(walls)
    walls.lineStyle(4,0xd8cdbb);walls.strokeRect(LEFT-27,211,RIGHT-LEFT+54,578)
    this.state.board.forEach((color,i)=>{if(color!==null){const p=position(i);this.bubble(p.x,p.y,color)}})
    this.guide=this.add.graphics();this.content.add(this.guide);this.drawGuide()
    this.bubble(SHOOTER.x,SHOOTER.y,this.state.current)
    this.text(654,690,'下一颗',20,this.content);this.bubble(654,737,this.state.next)
    this.button(654,810,'交换',()=>{
      if(this.shooting||this.state.status!=='playing')return
      this.history.push(this.state);this.state={...this.state,current:this.state.next,next:this.state.current};this.draw()
    },130,this.content)
    this.button(155,850,'撤销',()=>{if(this.shooting)return;this.state=this.history.pop()??this.state;this.draw()},170,this.content)
    this.button(384,850,'重新开始',()=>{if(this.shooting)return;this.state=newGame();this.history=[];this.draw()},200,this.content)
    if(this.state.status!=='playing'){
      this.guide.clear()
      this.text(384,450,this.state.status==='won'?'全部消除啦！':'泡泡堆满啦',32,this.content).setBackgroundColor('#fffdf6').setPadding(18)
      this.say(this.state.status==='won'?`完成！得分 ${this.state.score}`:'可以撤销一步，或重新开始')
    }
  }
  private drawGuide(): void {
    this.guide.clear()
    if(this.shooting||this.state.status!=='playing')return
    const shot=trace(this.state,this.angle)
    this.guide.fillStyle(0x527267,0.35)
    shot.path.forEach((p,i)=>{if(i%5===0)this.guide.fillCircle(p.x,p.y,3)})
    if(shot.index>=0){const p=position(shot.index);this.guide.lineStyle(2,0x527267,0.5);this.guide.strokeCircle(p.x,p.y,RADIUS)}
  }
  private fire(): void {
    if(this.shooting||this.state.status!=='playing')return
    const shot=trace(this.state,this.angle)
    if(shot.index<0){this.say('这里没有空位，换个方向试试');return}
    this.shooting=true;this.guide.clear();this.audio.playPlace(1)
    const moving=this.bubble(SHOOTER.x,SHOOTER.y,this.state.current)
    this.tweens.addCounter({from:0,to:shot.path.length-1,duration:Math.max(200,shot.path.length*5/0.8),onUpdate:tween=>{
      const p=shot.path[Math.min(shot.path.length-1,Math.floor(tween.getValue()??0))]!
      moving.setPosition(p.x,p.y)
    },onComplete:()=>{
      const old=this.state;this.history.push(old);this.state=settle(old,shot.index);this.shooting=false;this.draw()
      if(this.state.status==='won')this.audio.playWin()
      else if(this.state.status==='lost')this.audio.playGameOver()
      else if(this.state.score>old.score)this.audio.playMerge()
    }})
  }
}
