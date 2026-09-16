import { expect, it } from 'vitest'
import { newGame, place, SHAPES, UNIT, vertices } from '../../src/games/tangram/core/game'
it('uses seven authentic pieces with correct area proportions', () => {
  const areas=SHAPES.map(ps=>Math.abs(ps.reduce((sum,p,i)=>{const q=ps[(i+1)%ps.length]!;return sum+p.x*q.y-p.y*q.x},0))/2/(UNIT*UNIT))
  expect(areas.map(x=>Math.round(x))).toEqual([4,4,2,1,1,2,2])
})
it('requires shape alignment, snaps near targets and wins at every orientation', () => {
  for(let level=0;level<3;level++) {
    let state=newGame(level)
    expect(place(state,0,{...state.targets[0]!,rotation:state.targets[0]!.rotation+1}).pieces[0]!.placed).toBe(false)
    for(let i=0;i<7;i++) state=place(state,i,{...state.targets[i]!,x:state.targets[i]!.x+10})
    expect(state.won).toBe(true)
    expect(place(state,0,state.targets[0]!)).toBe(state)
  }
})
it('supports reflection and rejects distant placement without modifying input', () => {
  const state=newGame()
  const before=vertices(6,{...state.targets[6]!,flipped:false})
  const after=vertices(6,{...state.targets[6]!,flipped:true})
  expect(after).not.toEqual(before)
  expect(place(state,0,{...state.targets[0]!,x:0}).pieces[0]!.placed).toBe(false)
  expect(state.pieces.every(p=>!p.placed)).toBe(true)
})
it('keeps every target clear of the toolbar and loose-piece tray', () => {
  for(let level=0;level<3;level++) {
    const state=newGame(level)
    state.targets.forEach((target,index)=>vertices(index,target).forEach(point=>{
      expect(point.y).toBeGreaterThan(240)
      expect(point.y).toBeLessThan(600)
    }))
  }
})
