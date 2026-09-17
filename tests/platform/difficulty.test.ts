import { expect, it } from 'vitest'
import { MODES as pop, newGame as newPop, step as stepPop } from '../../src/games/pop-bubbles/core/game'
import { MODES as rain, newGame as newRain, step as stepRain } from '../../src/games/red-rain/core/game'
import { MODES as mole } from '../../src/games/whack-mole/core/game'
import { MODES as fruit } from '../../src/games/fruit-slicer/core/game'
import { newGame as memory } from '../../src/games/memory/core/game'

it('sets a meaningful reaction baseline without shrinking touch targets', () => {
  expect(pop[0]!.speed).toBeGreaterThanOrEqual(150)
  expect(pop[0]!.interval).toBeLessThanOrEqual(480)
  expect(pop[0]!.startRadius).toBeGreaterThanOrEqual(26)
  expect(rain[0]!.speed).toBeGreaterThanOrEqual(260)
  expect(rain[0]!.interval).toBeLessThanOrEqual(460)
  expect(mole[0]!.stayMs).toBeLessThanOrEqual(1400)
  expect(fruit[0]!.interval).toBeLessThanOrEqual(900)
  for(const modes of [pop,rain,fruit]) for(let i=1;i<modes.length;i++) {
    expect(modes[i]!.speed).toBeGreaterThan(modes[i-1]!.speed)
    expect(modes[i]!.interval).toBeLessThan(modes[i-1]!.interval)
  }
})
it('ramps the latter half of a round while keeping deterministic state transitions', () => {
  const p={...newPop(0,()=>0.5),bubbles:[{x:300,y:700,radius:26,golden:false}],spawnIn:10000}
  expect(stepPop({...p,elapsedMs:45000},100,()=>0.5).bubbles[0]!.y).toBeLessThan(stepPop(p,100,()=>0.5).bubbles[0]!.y)
  const r={...newRain(0,()=>0.5),drops:[{x:300,y:300,cracker:false}],spawnIn:10000}
  expect(stepRain({...r,elapsedMs:45000},100,()=>0.5).drops[0]!.y).toBeGreaterThan(stepRain(r,100,()=>0.5).drops[0]!.y)
  expect(p.bubbles[0]!.y).toBe(700)
})
it('supports the 12-pair entry memory board and preserves legacy 8-pair rules', () => {
  const state=memory(12,1,()=>0.4)
  expect(state.cards).toHaveLength(24)
  for(let i=0;i<12;i++)expect(state.cards.filter(v=>v===i)).toHaveLength(2)
  expect(memory(8).cards).toHaveLength(16)
})
