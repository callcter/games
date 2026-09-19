// Shared chrome integration: actual controls, resizing, board state and modal ownership.
// Run with APP_URL=<dev URL> node scripts/browser-shell-regression.mjs.
import assert from 'node:assert/strict'
import { withBrowser } from './lib/browser-session.mjs'

await withBrowser(async ({ send, evaluate, until, screenshot, pause }) => {
  const tap = async (x,y) => {
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await pause(150)
  }
  const tapChrome = async name => {
    const p = await evaluate(`(()=>{const b=window.chromeNodes().find(b=>b.name===${JSON.stringify(name)}),r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+b.x*r.width/__scene.scale.width,y:r.y+b.y*r.height/__scene.scale.height}})()`)
    await tap(p.x,p.y)
  }
  const closeHelp = async () => {
    const p=await evaluate(`(()=>{const r=document.querySelector('.game-help-close').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await tap(p.x,p.y)
    await until('__scene.sys.isActive()')
  }
  await evaluate(`window.chromeNodes=()=>{const result=[];const visit=o=>{if(o.name?.startsWith('chrome-'))result.push(o);if(o.list)o.list.forEach(visit)};__scene.children.list.forEach(visit);return result}`)
  for(const [id,path,cls] of [
    ['2048','game-2048','Game2048Scene'],['gomoku','gomoku','GomokuScene'],
    ['tetris','tetris','TetrisScene'],['minesweeper','minesweeper','MinesweeperScene'],
    ['pipes','puzzle-kit','PuzzleScene'],['pop-bubbles','puzzle-kit','PuzzleScene'],
    ['water-sort','water-sort','WaterSortScene'],['tile-match','tile-match','TileMatchScene']
  ].filter(([id]) => !process.env.SHELL_GAMES || process.env.SHELL_GAMES.split(',').includes(id))) {
    await evaluate(`(async()=>{const {${cls}:C}=await import('/src/games/${path}/scene.ts');if(!C.prototype.__shellTest){const old=C.prototype.create;C.prototype.create=function(){window.__scene=this;return old.call(this)};C.prototype.__shellTest=true}})()`)
    await evaluate(`document.querySelector('[data-game="${id}"]').click()`)
    await until(`window.__scene?.sys.settings.key==='${id==='2048'?'game-2048':id}'`)
    if(id!=='pop-bubbles') { await until("!!document.querySelector('.game-help-dialog[open]')"); await closeHelp() }
    const independent = id==='water-sort'||id==='tile-match'
    const saved = await evaluate('JSON.stringify(__scene.state)')
    if(id==='2048') {
      // 全量重绘纹理泄漏回归：children.removeAll(true) 是 List 的 skipCallback 语义（不销毁对象），
      // 误用会让 Text 的 canvas 纹理随每步重绘累积（2048 越玩越卡的根因）。连续走子后纹理数必须收敛。
      const texCount = () => evaluate('__scene.textures.getTextureKeys().length')
      const before = await texCount()
      for(let i=0;i<40;i++) await evaluate(`window.__scene.move('${['left','down','right','up'][i%4]}')`)
      const after = await texCount()
      assert.ok(after - before <= 12, `2048: texture leak across redraws (${before} -> ${after})`)
    }
    for(const [width,height] of [[390,844],[768,1024],[1024,768],[390,844]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false})
      await pause(400)
      const ratio = await evaluate(`(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {css:r.width/r.height,logical:__scene.scale.width/__scene.scale.height,physical:c.width/c.height}})()`)
      assert.ok(Math.abs(ratio.css-ratio.logical)<0.002 && Math.abs(ratio.physical-ratio.logical)<0.002, `${id}: distorted after rotation ${JSON.stringify(ratio)}`)
      if(independent) {
        assert.equal(await evaluate('JSON.stringify(__scene.state)'),saved,'rotation must preserve board')
        await screenshot(`${id}-${width}`)
        continue
      }
      const boxes=await evaluate(`window.chromeNodes().map(o=>({name:o.name,x:o.x-o.width/2,y:o.y-o.height/2,w:o.width,h:o.height,view:__scene.scale.width}))`)
      assert.equal(boxes.length,id==='pipes'||id==='pop-bubbles'?4:5)
      for(const a of boxes) {
        assert.ok(a.x>=0 && a.x+a.w<=a.view, `${id} ${width}: bounds ${JSON.stringify(a)}`)
        for(const b of boxes) if(a.name!==b.name) assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`${id} ${width}: overlap ${a.name} / ${b.name}`)
      }
      const muted=await evaluate('__scene.audio.isMuted')
      await tapChrome('chrome-sound')
      assert.equal(await evaluate('__scene.audio.isMuted'),!muted,`${id}: sound control`)
      await tapChrome('chrome-sound')
      await tapChrome('chrome-help')
      await until("!!document.querySelector('.game-help-dialog[open]')")
      await closeHelp()
      await screenshot(`${id}-${width}`)
    }
    if(['pipes','minesweeper','tetris'].includes(id)) {
      const canvasTap = async (x,y) => {
        const p=await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+${x}*r.width/__scene.scale.width,y:r.y+${y}*r.height/__scene.scale.height}})()`)
        await tap(p.x,p.y)
      }
      if(id==='pipes') {
        const point=await evaluate('({x:99+570/__scene.size/2,y:240+570/__scene.size/2+__scene.contentOffsetY})')
        await canvasTap(point.x,point.y)
        assert.equal(await evaluate('__scene.state.moves'),1,'rotated pipe hit must rotate exactly one cell')
      }
      if(id==='minesweeper') {
        await canvasTap(44+680/18,238+680/18)
        assert.ok(await evaluate('__scene.state.cells.some(c=>c.visibility==="revealed")'),'first touch must reveal board')
      }
      if(id==='tetris') {
        const controls=await evaluate('({y:__scene.layout.board.y+__scene.layout.board.height+105,w:__scene.scale.width})')
        await canvasTap(70,controls.y)
        assert.ok(await evaluate('!!__scene.state.holdType'),'hold control must work after rotation')
        await canvasTap(controls.w/2,controls.y)
        assert.ok(await evaluate('__scene.state.board.some(Boolean)'),'hard drop must lock a piece')
        await canvasTap(controls.w-70,controls.y)
        assert.ok(await evaluate('__scene.paused'),'pause control must work')
      }
    }
    if(independent) await evaluate('history.back()')
    else await tapChrome('chrome-back')
    await until("!!document.querySelector('.game-grid')")
    console.log(`${id}: chrome bounds, rotation, sound/help/back passed`)
  }
})
