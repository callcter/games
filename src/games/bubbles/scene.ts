import Phaser from 'phaser'
import { releaseHostBackdrop, setHostBackdropImage } from '../../platform/display/host-backdrop'
import type { GameAudio } from '../../platform/audio/game-audio'
import { COLORS, PuzzleScene } from '../puzzle-kit/scene'
import { recordBest } from '../puzzle-kit/progress'
import { LEFT, newGame, position, RADIUS, RIGHT, settle, SHOOTER, trace, type BubbleState } from './core/game'
import { PRODUCT_V3, addCoverImage, preloadBubblesV3 } from '../../platform/display/product-v3-art'
const SYMBOLS=['●','★','♥','◆','✚']
export class BubblesScene extends PuzzleScene {
  private state = newGame(Math.random,4,5)
  private angle = 0
  private shooting = false
  private aiming = false
  private guide!: Phaser.GameObjects.Graphics
  private history: BubbleState[] = []
  private colors = 4
  private startRows = 5
  constructor(audio: GameAudio, exit: () => void) { super('bubbles','泡泡龙',audio,exit) }
  preload(): void { preloadBubblesV3(this) }
  private restart(): void { this.state = newGame(Math.random, this.colors, this.startRows); this.history = []; this.draw() }
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
    if(this.textures.exists(PRODUCT_V3.bubbles.bubbles)){
      node.add(this.add.image(0,0,PRODUCT_V3.bubbles.bubbles,color).setDisplaySize(RADIUS*1.95,RADIUS*1.95))
    }else{
      node.add(this.add.circle(0,0,RADIUS,COLORS[color]!).setStrokeStyle(3,0xffffff))
      this.text(0,0,SYMBOLS[color]!,22,node).setColor('#ffffff')
    }
    return node
  }
  private draw(): void {
    this.resetView(`得分 ${this.state.score} · 发射 ${this.state.shots} 次 · 同色 3 个一起消除`)
    const background=addCoverImage(this,PRODUCT_V3.bubbles.background,768,900,-20,0.88)
    if(background)this.content.addAt(background,0)
    setHostBackdropImage('art/product-v3/backgrounds/bubbles.webp')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, releaseHostBackdrop)
    this.events.once(Phaser.Scenes.Events.DESTROY, releaseHostBackdrop)
    const hard = this.colors === 5
    this.button(280,153,`${hard?'':'✓ '}4 色 · 基础`,()=>{if(this.shooting)return;this.colors=4;this.startRows=5;this.restart()},160,this.content)
    this.button(490,153,`${hard?'✓ ':''}5 色 · 挑战`,()=>{if(this.shooting)return;this.colors=5;this.startRows=6;this.restart()},160,this.content)
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
    this.button(384,850,'重新开始',()=>{if(this.shooting)return;this.restart()},200,this.content)
    if(this.state.status!=='playing'){
      this.guide.clear()
      recordBest(`bubbles-${this.colors}`,this.state.score,false)
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
    // 发射口快速扩散的圆环，给「打出去」一个起点感。
    const muzzle=this.add.graphics().setDepth(50)
    muzzle.lineStyle(4,0xffffff,0.7);muzzle.strokeCircle(SHOOTER.x,SHOOTER.y,14)
    this.tweens.add({targets:muzzle,scale:1.8,alpha:0,duration:180,ease:'Cubic.Out',onComplete:()=>muzzle.destroy()})
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
