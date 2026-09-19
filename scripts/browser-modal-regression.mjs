// Race and rotation regressions, run against the dev server.
import assert from 'node:assert/strict'
import {withBrowser} from './lib/browser-session.mjs'
await withBrowser(async({send,evaluate,until,pause,screenshot})=>{
  await evaluate(`(async()=>{const {PuzzleScene:C}=await import('/src/games/puzzle-kit/scene.ts');const old=C.prototype.create;C.prototype.create=function(){window.__scene=this;return old.call(this)}})()`)
  await evaluate(`document.querySelector('[data-game="pop-bubbles"]').click()`)
  await until("window.__scene?.sys.settings.key==='pop-bubbles'")
  const count=await evaluate(`(async()=>{const {showSceneModal:show}=await import('/src/ui/dom/scene-modal.ts');const draw=d=>d.textContent='race';const first=show(__scene,draw);first.close();window.secondModal=show(__scene,draw);await new Promise(r=>__scene.game.events.once('poststep',r));window.thirdModal=show(__scene,draw);return document.querySelectorAll('dialog[open]').length})()`)
  assert.equal(count,1,'old close callback must not remove new modal ownership')
  await evaluate('secondModal.close(); thirdModal.close()')
  await until('__scene.sys.isActive()')
  // End the round through the existing lifecycle to inspect the otherwise 60-second result.
  const listeners=await evaluate('__scene.scale.listenerCount("resize")')
  await evaluate('__scene.launch(0,60); __scene.endRound()')
  await until('!!__scene.resultDialog')
  for(const [width,height] of [[390,844],[1024,768],[768,1024]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false})
    await pause(400)
    const bounds=await evaluate('(()=>{const d=__scene.resultDialog.card;return {y:d.y,h:__scene.scale.height}})()')
    assert.ok(Math.abs(bounds.y-bounds.h/2)<1,`result must recenter: ${JSON.stringify(bounds)}`)
    await screenshot(`result-${width}`)
  }
  const p=await evaluate(`(()=>{const d=__scene.resultDialog.card,r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+d.x*r.width/__scene.scale.width,y:r.y+(d.y+22)*r.height/__scene.scale.height}})()`)
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]})
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  await until('__scene.running && !__scene.resultDialog')
  assert.equal(await evaluate('__scene.scale.listenerCount("resize")'),listeners,'closed result must remove resize listener')
  console.log('Modal ownership, result rotation, replay input and listener cleanup passed')

})
