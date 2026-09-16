import { expect, it } from 'vitest'
import { COLS, LEFT, newGame, neighbors, position, RIGHT, settle, trace } from '../../src/games/bubbles/core/game'
it('uses symmetric hex neighbors and deterministic colors',()=>{
  expect(newGame(()=>0.2)).toEqual(newGame(()=>0.2))
  for(let i=0;i<40;i++)for(const n of neighbors(i))expect(neighbors(n)).toContain(i)
  expect(position(COLS).x-position(0).x).toBe(25)
})
it('removes matching groups and drops unsupported bubbles',()=>{
  const state=newGame();state.board.fill(null);state.board[0]=0;state.board[1]=0;state.board[COLS+1]=1;state.current=0
  const next=settle(state,COLS,()=>0)
  expect(next.status).toBe('won');expect(next.score).toBe(40)
  expect(state.board[0]).toBe(0)
})
it('does not remove a pair and rejects occupied or detached slots',()=>{
  const state=newGame();state.board.fill(null);state.board[0]=0;state.current=0
  expect(settle(state,1).board.filter(c=>c!==null)).toHaveLength(2)
  expect(settle(state,0)).toBe(state);expect(settle(state,70)).toBe(state)
})
it('traces upward shots and wall bounces to vacant cells',()=>{
  const state=newGame()
  for(const angle of [-1.2,-0.5,0,0.5,1.2]){
    const shot=trace(state,angle)
    expect(shot.index).toBeGreaterThanOrEqual(0)
    expect(state.board[shot.index]).toBeNull()
    expect(shot.path.every(p=>p.x>=LEFT&&p.x<=RIGHT)).toBe(true)
  }
})
