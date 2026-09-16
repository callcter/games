import { expect, it } from 'vitest'
import { intersectionArea, LEVEL_NAMES, newGame, place, SHAPES, UNIT, vertices } from '../../src/games/tangram/core/game'
it('uses seven authentic pieces with correct area proportions', () => {
  const areas=SHAPES.map(ps=>Math.abs(ps.reduce((sum,p,i)=>{const q=ps[(i+1)%ps.length]!;return sum+p.x*q.y-p.y*q.x},0))/2/(UNIT*UNIT))
  expect(areas.map(x=>Math.round(x))).toEqual([4,4,2,1,1,2,2])
})
it('requires shape alignment, snaps near targets and wins at every orientation', () => {
  for(let level=0;level<LEVEL_NAMES.length;level++) {
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
  for(let level=0;level<LEVEL_NAMES.length;level++) {
    const state=newGame(level)
    state.targets.forEach((target,index)=>vertices(index,target).forEach(point=>{
      expect(point.y).toBeGreaterThan(240)
      expect(point.y).toBeLessThan(600)
    }))
  }
})
it('has non-overlapping targets in every silhouette', () => {
  LEVEL_NAMES.forEach((_, level) => {
    const state = newGame(level)
    state.targets.forEach((pose,i) => state.targets.forEach((other,j) => {
      if (i !== j) expect(intersectionArea(vertices(i,pose),vertices(j,other))).toBeLessThan(0.01)
    }))
  })
})
it('accepts swapped identical triangles in silhouette mode but not overlapping pieces', () => {
  let state = newGame()
  const swapped = { ...state.targets[1]!, rotation: 6 }
  state = place(state, 0, swapped, true)
  expect(state.pieces[0]!.placed).toBe(true)
  expect(place(state, 1, state.targets[1]!, true).pieces[1]!.placed).toBe(false)
  state = place(state, 1, { ...state.targets[0]!, rotation: 2 }, true)
  for (let i = 2; i < 7; i++) state = place(state, i, state.targets[i]!, true)
  expect(state.won).toBe(true)
})
it('rejects silhouette placements outside the outline', () => {
  const state = newGame()
  expect(place(state, 0, { ...state.targets[0]!, x: 120 }, true).pieces[0]!.placed).toBe(false)
})
it('accepts an alternative partition across several reference pieces', () => {
  const state = newGame()
  // 大三角放在方块底部，覆盖原分块中的多个小块，而非任一指定大三角槽位。
  const alternate = { x: 384, y: 500, rotation: 4, flipped: false }
  expect(place(state, 0, alternate, true).pieces[0]!.placed).toBe(true)
  expect(place(state, 0, alternate).pieces[0]!.placed).toBe(false)
})
