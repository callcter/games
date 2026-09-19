// Fresh-user regressions for shared help and board zoom. Run against pnpm dev.
import assert from 'node:assert/strict'
import { withBrowser } from './lib/browser-session.mjs'

await withBrowser(async ({ send, evaluate, until, screenshot, pause }) => {
  const tap = async (x, y) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await pause(80)
  }
  const canvasTap = async (x, y) => {
    // v4 起内容层整体纵移（portrait-fluid）；gomoku/合成水果等非 PuzzleScene 无偏移。
    const p = await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();const off=__scene.contentOffsetY||0;return {x:r.x+${x}*r.width/__scene.scale.width,y:r.y+(${y}+off)*r.height/__scene.scale.height}})()`)
    await tap(p.x, p.y)
  }
  const open = async (id, path, name) => {
    await evaluate(`(async()=>{const {${name}:C}=await import('/src/games/${path}/scene.ts');if(!C.prototype.__uiTest){const create=C.prototype.create;C.prototype.create=function(){window.__scene=this;return create.call(this)};C.prototype.__uiTest=true}})()`)
    await evaluate(`document.querySelector('.game-grid [data-game="${id}"]').click()`)
    await until(`window.__scene?.sys.settings.key==='${id}'`)
  }
  const closeHelp = async () => {
    const p = await evaluate(`(()=>{const r=document.querySelector('.game-help-close').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await tap(p.x, p.y)
    await until("!document.querySelector('.game-help-dialog')")
  }
  const home = async () => {
    await evaluate('history.back()')
    await until("!!document.querySelector('.game-grid')")
  }
  const showHelp = () => evaluate(`(async()=>{const {showHelpPanel}=await import('/src/ui/phaser/help.ts');showHelpPanel(__scene,__scene.heading ?? (__scene.sys.settings.key==='tetris'?'俄罗斯方块':'五子棋'))})()`)

  await send('Emulation.setDeviceMetricsOverride', { width:768, height:1024, deviceScaleFactor:1, mobile:false })
  await open('pipes', 'puzzle-kit', 'PuzzleScene')
  // 无头 Chrome 的 rAF 可能节流，场景时钟慢于真实设备；必须等首弹真正打开再断言输入隔离
  await until("!!document.querySelector('.game-help-dialog[open]')")
  const before = await evaluate('JSON.stringify(__scene.state)')
  await canvasTap(630, 650)
  assert.equal(await evaluate('JSON.stringify(__scene.state)'), before, '帮助显示时不得旋转背后的水管')

  for (const [width,height] of [[768,1024],[1024,768],[390,844],[667,375]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await pause(200)
    const layout = await evaluate(`(()=>{const d=document.querySelector('.game-help-dialog'),b=d.querySelector('button'),list=[...d.querySelectorAll('li')];const r=d.getBoundingClientRect();return {count:list.length,visible:list.every(e=>getComputedStyle(e).visibility==='visible'),fits:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,scrollable:d.querySelector('.game-help-body').scrollHeight>=d.querySelector('.game-help-body').clientHeight,buttonVisible:b.getBoundingClientRect().bottom<=innerHeight}})()`)
    assert.equal(layout.count,3)
    assert.ok(layout.visible && layout.fits && layout.buttonVisible && layout.scrollable, JSON.stringify(layout))
    await screenshot(`help-${width}`)
  }
  await closeHelp()
  assert.equal(await evaluate('JSON.stringify(__scene.state)'), before, '关闭帮助的手势不得走子')
  await until('__scene.sys.isActive()')
  await showHelp(); await showHelp()
  assert.equal(await evaluate("document.querySelectorAll('.game-help-dialog').length"),1,'重复打开不叠加模态')
  await closeHelp(); await until('__scene.sys.isActive()')
  await evaluate('void __scene.sys.pause()')
  await showHelp(); await closeHelp()
  assert.ok(await evaluate('__scene.sys.isPaused()'),'原先系统暂停的场景不能被帮助唤醒')
  await evaluate('void __scene.sys.resume()')
  const baseline = await evaluate('JSON.stringify([__scene.scale.listenerCount("resize"),__scene.events.listenerCount("shutdown"),__scene.events.listenerCount("destroy")])')
  for (let n=0;n<10;n++) { await showHelp(); await closeHelp(); await until('__scene.sys.isActive()') }
  assert.equal(await evaluate('JSON.stringify([__scene.scale.listenerCount("resize"),__scene.events.listenerCount("shutdown"),__scene.events.listenerCount("destroy")])'), baseline, '关闭后监听器必须回到基线')
  await showHelp()
  await home()
  // game.destroy() 是挂起到下一帧才发 DESTROY；大厅出现不等于清理完成，等它落地再断言。
  await until("document.querySelectorAll('.game-help-dialog').length===0")
  assert.equal(await evaluate("document.querySelectorAll('.game-help-dialog').length"),0,'离开游戏必须清理原生弹窗')

  await send('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false})
  await open('tetris','tetris','TetrisScene')
  await until("!!document.querySelector('.game-help-dialog[open]')")
  await closeHelp()
  for (const paused of [false,true]) {
    await evaluate(`if(__scene.paused!==${paused})__scene.togglePause()`)
    await showHelp()
    const state=await evaluate('JSON.stringify(__scene.state)')
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40})
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40})
    await pause(1100)
    assert.equal(await evaluate('JSON.stringify(__scene.state)'),state,'看规则时计时、键盘必须停止')
    await closeHelp()
    await until('__scene.sys.isActive()')
    assert.equal(await evaluate('__scene.paused'),paused,'恢复原先的手动暂停状态')
    if(!paused) { await until(`JSON.stringify(__scene.state)!==${JSON.stringify(state)}`) }
  }
  await home()

  // 不同架构的代表：经典纸牌长文案、独立场景、action-kit 的逐帧倒计时与 Matter 世界。
  for (const [id,path,name,title,first] of [
    ['freecell','freecell','FreeCellScene','空当接龙',true],
    ['water-sort','water-sort','WaterSortScene','水排序',true],
    ['pop-bubbles','puzzle-kit','PuzzleScene','点泡泡',false],
    ['merge-fruit','merge-fruit','MergeFruitScene','合成水果',true]
  ]) {
    await open(id,path,name)
    if(first) { await until("!!document.querySelector('.game-help-dialog[open]')"); await closeHelp() }
    if(id==='pop-bubbles') { await canvasTap(160,400); await until('__scene.running') }
    if(id==='merge-fruit') { await canvasTap(384,400); await until('__scene.fruits.size>0') }
    await evaluate(`(async()=>{const {showHelpPanel}=await import('/src/ui/phaser/help.ts');showHelpPanel(__scene,${JSON.stringify(title)})})()`)
    assert.ok(await evaluate('__scene.sys.isPaused()'))
    const snapshot = id==='pop-bubbles' ? '__scene.remainingMs' : id==='merge-fruit' ? 'JSON.stringify([...__scene.fruits].map(f=>[f.x,f.y]))' : null
    if(snapshot) {
      const value=await evaluate(snapshot)
      await pause(500)
      assert.equal(await evaluate(snapshot),value,`${id}: 帮助期间物理/回合时钟保持不变`)
    }
    if(id==='freecell') {
      await send('Emulation.setDeviceMetricsOverride',{width:667,height:375,deviceScaleFactor:1,mobile:false})
      await pause(150)
      await evaluate("document.querySelector('.game-help-body').scrollTop=10000")
      assert.ok(await evaluate("(()=>{const body=document.querySelector('.game-help-body'),last=body.querySelector('li:last-child');return last.getBoundingClientRect().bottom<=body.getBoundingClientRect().bottom})()"),'短横屏可以滚动读完长说明')
      await screenshot('help-long-landscape')
    }
    await closeHelp(); await until('__scene.sys.isActive()')
    await home()
  }

  await open('gomoku','gomoku','GomokuScene')
  await until("!!document.querySelector('.game-help-dialog[open]')")
  await closeHelp()
  await evaluate("__scene.setMode('two-player')")
  await evaluate("document.querySelector('[data-zoom]').click()")
  assert.equal(await evaluate('__scene.cameras.main.zoom'),1,'棋盘缩放不能改变顶栏相机')
  assert.ok(await evaluate('__scene.boardLayer.scaleX>1'),'棋盘必须真的放大')
  const state=await evaluate('JSON.stringify(__scene.state)')
  const p=await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),g=__scene.geometry;return {x:r.x+(g.x+g.size/2)*r.width/__scene.scale.width,y:r.y+(g.y+g.size/2)*r.height/__scene.scale.height}})()`)
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]})
  for(let n=1;n<=10;n++) await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+n*5,y:p.y}]})
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  await pause(100)
  assert.equal(await evaluate('JSON.stringify(__scene.state)'),state,'拖棋盘抬手不能误落子')
  const target=await evaluate(`(()=>{const g=__scene.geometry,l=__scene.boardLayer,r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+(l.x+(g.x+8*g.spacing)*l.scaleX)*r.width/__scene.scale.width,y:r.y+(l.y+(g.y+8*g.spacing)*l.scaleY)*r.height/__scene.scale.height}})()`)
  await tap(target.x,target.y)
  assert.equal(await evaluate('__scene.state.board[112]'),1,'缩放平移后落子坐标正确')
  for(const [width,height] of [[768,1024],[1024,768],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false})
    await pause(250)
    assert.equal(await evaluate('__scene.state.board[112]'),1,'旋转保留棋局')
    await screenshot(`gomoku-zoom-${width}`)
  }
  await showHelp()
  await closeHelp()
  await until('__scene.sys.isActive()')
  const pinch=await evaluate(`(()=>{const g=__scene.geometry,r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+(g.x+g.size/2)*r.width/__scene.scale.width,y:r.y+(g.y+g.size/2)*r.height/__scene.scale.height}})()`)
  const prePinch=await evaluate('JSON.stringify(__scene.state)')
  const preZoom=await evaluate('__scene.boardZoom')
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:pinch.x-35,y:pinch.y},{id:2,x:pinch.x+35,y:pinch.y}]})
  for(let n=1;n<=5;n++) await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:pinch.x-35-n*5,y:pinch.y},{id:2,x:pinch.x+35+n*5,y:pinch.y}]})
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  await until(`__scene.boardZoom>${preZoom}`)
  assert.equal(await evaluate('JSON.stringify(__scene.state)'),prePinch,'双指手势不落子')
  await canvasTap(299,46)
  await until('__scene.boardZoom===1 && __scene.state.board.every(c=>c===0)')
  await canvasTap(41,46)
  await until("!!document.querySelector('.game-grid')")
  console.log('新用户帮助、输入隔离、计时恢复、监听清理、棋盘缩放与旋转通过')
})
