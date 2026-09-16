import type { RandomSource } from '../../cards/core/cards'
export const COLS = 8, ROWS = 11, RADIUS = 24, STEP = 50
export const LEFT = 172, RIGHT = 572, TOP = 240, SHOOTER = {x:384,y:755}
export interface Point { x: number; y: number }
export interface BubbleState { board: (number | null)[]; current: number; next: number; score: number; shots: number; status: 'playing' | 'won' | 'lost' }
export function position(index: number): Point { const row=Math.floor(index/COLS);return {x:LEFT+(index%COLS)*STEP+(row%2)*STEP/2,y:TOP+row*STEP*Math.sqrt(3)/2} }
export function neighbors(index: number): number[] {
  const p=position(index)
  return Array.from({length:COLS*ROWS},(_,i)=>i).filter(i=>i!==index&&Math.hypot(position(i).x-p.x,position(i).y-p.y)<STEP+1)
}
function choose(board: readonly (number|null)[], random: RandomSource): number {
  const colors=[...new Set(board.filter((v):v is number=>v!==null))]
  const value=random(), fraction=Number.isFinite(value)?Math.max(0,Math.min(0.999999,value)):0
  return colors[Math.floor(fraction*colors.length)]??0
}
export function newGame(random: RandomSource = Math.random): BubbleState {
  const board=Array.from({length:COLS*ROWS},(_,i)=>i<COLS*4?Math.floor(i/COLS)%3:null)
  return {board,current:choose(board,random),next:choose(board,random),score:0,shots:0,status:'playing'}
}
export function trace(state: BubbleState, angle: number): {path: Point[]; index: number} {
  if(!Number.isFinite(angle))return {path:[],index:-1}
  const a=Math.max(-1.2,Math.min(1.2,angle)), path:Point[]=[{...SHOOTER}]
  let x=SHOOTER.x,y=SHOOTER.y,vx=Math.sin(a)*5; const vy=-Math.cos(a)*5
  for(let step=0;step<600;step++){
    x+=vx;y+=vy
    if(x<LEFT){x=LEFT+(LEFT-x);vx=Math.abs(vx)}
    if(x>RIGHT){x=RIGHT-(x-RIGHT);vx=-Math.abs(vx)}
    path.push({x,y})
    const hit=state.board.findIndex((color,i)=>color!==null&&Math.hypot(position(i).x-x,position(i).y-y)<=RADIUS*2)
    if(y<=TOP||hit>=0){
      const candidates=(hit>=0?neighbors(hit):Array.from({length:COLS},(_,i)=>i)).filter(i=>state.board[i]===null)
      candidates.sort((a,b)=>Math.hypot(position(a).x-x,position(a).y-y)-Math.hypot(position(b).x-x,position(b).y-y))
      return {path,index:candidates[0]??-1}
    }
  }
  return {path,index:-1}
}
export function settle(state: BubbleState, index: number, random: RandomSource = Math.random): BubbleState {
  if(state.status!=='playing')return state
  if(!Number.isInteger(index)||index<0||index>=state.board.length||state.board[index]!==null)return state
  if(index>=COLS&&!neighbors(index).some(i=>state.board[i]!==null))return state
  const board=[...state.board];board[index]=state.current
  const group=[index],seen=new Set(group)
  for(let h=0;h<group.length;h++)for(const n of neighbors(group[h]!))if(board[n]===state.current&&!seen.has(n)){seen.add(n);group.push(n)}
  let removed=0
  if(group.length>=3){
    group.forEach(i=>{board[i]=null;removed++})
    const supported=Array.from({length:COLS},(_,i)=>i).filter(i=>board[i]!==null),connected=new Set(supported)
    for(let h=0;h<supported.length;h++)for(const n of neighbors(supported[h]!))if(board[n]!==null&&!connected.has(n)){connected.add(n);supported.push(n)}
    board.forEach((color,i)=>{if(color!==null&&!connected.has(i)){board[i]=null;removed++}})
  }
  const status=board.every(c=>c===null)?'won':board.some((c,i)=>c!==null&&Math.floor(i/COLS)>=ROWS-1)?'lost':'playing'
  const current=board.includes(state.next)?state.next:choose(board,random)
  return {board,current,next:choose(board,random),shots:state.shots+1,score:state.score+removed*10,status}
}
