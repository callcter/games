// 无额外依赖。先运行 pnpm dev，再运行 pnpm test:browser。
// 独立临时 Chrome 配置，不读取或修改平时浏览器的存档。
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const profile = await mkdtemp(join(tmpdir(), 'games-browser-profile-'))
const artifacts = await mkdtemp(join(tmpdir(), 'games-browser-report-'))
const chrome = spawn(process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking', 'about:blank'
], { stdio: 'ignore' })
let launchError
chrome.on('error', error => { launchError = error })
const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms))
let ws
try {
  let port
  for (let i = 0; i < 100; i++) {
    if (launchError) throw launchError
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break } catch { await pause(100) }
  }
  assert.ok(port, 'Chrome 未启动；可用 CHROME_PATH 指定可执行文件')
  const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(tab => tab.type === 'page')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
  let serial = 0
  const waiting = new Map(), errors = []
  const send = (method, params = {}) => new Promise((resolve,reject) => {
    const id = ++serial
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
    waiting.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }))
  })
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
    const callback = waiting.get(message.id)
    if (callback) { clearTimeout(callback.timer); waiting.delete(message.id); message.error ? callback.reject(message.error) : callback.resolve(message.result) }
  }
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const until = async expression => {
    // 线上首次预缓存含本地图集，慢网络允许更长等待；本地仍快速暴露超时。
    for(let i=0;i<(process.env.PRODUCTION_ONLY ? 600 : 100);i++){
      try { if(await evaluate(expression)) return }
      catch(error) { if(error?.code !== -32000 || !/navigated|context|closed/i.test(error.message)) throw error }
      await pause(100)
    }
    await screenshot('timeout')
    console.log(await evaluate("({scene:window.__scene?.sys?.settings.key, alive:window.__scene?.alive, html:document.body.innerHTML.slice(0,1000),resources:performance.getEntriesByType('resource').slice(-12).map(e=>[e.name,e.duration])})"))
    throw new Error(`等待超时: ${expression}\n${JSON.stringify(errors)}\n${await evaluate("document.body.innerText")}`)
  }
  const screenshot = async name => {
    const result = await send('Page.captureScreenshot')
    await writeFile(join(artifacts, `${name}.png`), Buffer.from(result.data,'base64'))
    return result.data
  }
  const point = (x,y) => evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+${x}*r.width/768,y:r.y+${y}*r.height/900}})()`)
  const click = async (x,y) => {
    const p = await point(x,y)
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await pause(30)
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await pause(30)
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await pause()
  }
  // 只在开发服中观察场景状态，不在产品中暴露调试入口。
  const open = async id => {
    await evaluate(`(async()=>{const {PuzzleScene}=await import('/src/games/puzzle-kit/scene.ts');if(!PuzzleScene.prototype.__test){const create=PuzzleScene.prototype.create;PuzzleScene.prototype.create=function(){window.__scene=this;return create.call(this)};PuzzleScene.prototype.__test=true}})()`)
    // 叠叠消 v2 不再继承 PuzzleScene，单独挂 __scene 观察句柄。
    await evaluate(`(async()=>{const mod=await import('/src/games/tile-match/scene.ts');const cls=mod.TileMatchScene;if(!cls.prototype.__test){const create=cls.prototype.create;cls.prototype.create=function(){window.__scene=this;return create.call(this)};cls.prototype.__test=true}})()`)
    await evaluate(`(async()=>{const mod=await import('/src/games/water-sort/scene.ts');const cls=mod.WaterSortScene;if(!cls.prototype.__test){const create=cls.prototype.create;cls.prototype.create=function(){window.__scene=this;return create.call(this)};cls.prototype.__test=true}})()`)
    // reload/导航后大厅卡片可能尚未渲染完成，先等卡片再点（修复随机 null.click）。
    await until(`!!document.querySelector('.game-grid [data-game="${id}"]')`)
    await evaluate(`document.querySelector('.game-grid [data-game="${id}"]').click()`)
    await until(`window.__scene?.sys?.settings.key==='${id}' && (__scene.alive === undefined || __scene.alive)`)
    await pause(400)
  }
  const home = async () => { await click(90,45); await until("!!document.querySelector('.game-grid')") }
  const resumeOrFresh = async () => { const m = await evaluate("__scene.message ?? ''"); if(String(m).includes('找到')) await click(510,480) }
  await send('Runtime.enable')
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1})
  await send('Page.navigate',{url:base})
  await until("!!document.querySelector('.game-grid')")
  // 预置全部玩法说明为"已看过"：首弹面板会吞掉棋盘输入，回归专注原有链路
  // （帮助面板本身由 help-verify 类脚本单独验收）。
  await evaluate(`(async()=>{const m = await import('/src/ui/help-content.ts');try{localStorage.setItem('family-game-room-help-seen-v1',JSON.stringify(m.allHelpTitles))}catch(e){}return 1})()`)
  if (process.env.AUDIT_ONLY) {
    await until("document.querySelectorAll('.game-grid [data-game]').length >= 24")
    const ids = await evaluate("Array.from(document.querySelectorAll('.game-grid [data-game]'), e => e.dataset.game)")
    assert.ok(ids.length >= 24, '全量审查必须覆盖所有游戏')
    for (const [width,height] of [[768,1024],[1024,768]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
      await pause(1800)
      const layout = await send('Page.getLayoutMetrics')
      const shot = await send('Page.captureScreenshot', { captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: layout.cssContentSize.height, scale: 1 } })
      await writeFile(join(artifacts, `home-${width}.png`), Buffer.from(shot.data, 'base64'))
      for (const id of ids) {
        await evaluate(`document.querySelector('.game-grid [data-game="${id}"]').click()`)
        await until("!!document.querySelector('canvas')"); await pause(1200)
        await screenshot(`${id}-${width}`)
        if (['nonogram','sudoku','water-sort','parking','sokoban'].includes(id)) {
          await click(260,480); await pause(300)
          if(id==='sokoban') await click(128,216)
          await screenshot(`${id}-board-${width}`)
        }
        if (['pop-bubbles','red-rain','whack-mole','fruit-slicer'].includes(id)) {
          if(id==='fruit-slicer') await click(384,508)
          else await click(160,400)
          await pause(2200)
          await screenshot(`${id}-playing-${width}`)
        }
        await evaluate('history.back()'); await until("!!document.querySelector('.game-grid')")
      }
    }
  } else if (process.env.PRODUCTION_ONLY) {
    // 生产包不暴露场景对象；验证真实发布资源、点击启动、SW 接管和离线再打开。
    await until("(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'})()")
    // prompt 模式首次安装不会强行接管当前页面；下一次导航才受新 SW 控制。
    await send('Page.reload');await until("!!document.querySelector('.game-grid') && !!navigator.serviceWorker.controller")
    for (const [width,height] of [[768,1024],[1024,768]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false})
      for (const id of ['water-sort','parking','tile-match']) {
        await evaluate(`document.querySelector('.game-grid [data-game="${id}"]').click()`)
        await until("!!document.querySelector('canvas')");await pause(800)
        await click(608,165);await pause(500)
        await click(680,45);await click(680,45)
        await screenshot(`production-${id}-${width}`)
        await home()
      }
    }
    await send('Network.enable')
    await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0})
    await send('Page.reload');await until("!!document.querySelector('.game-grid')")
    await evaluate(`document.querySelector('.game-grid [data-game="water-sort"]').click()`)
    await until("!!document.querySelector('canvas')");await pause(700)
    await screenshot('production-offline')
    await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})
  } else if (process.env.RENDER_ONLY) {
    for (const [width,height] of [[768,1024],[1024,768]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false})
      for (const id of ['2048','gomoku','tetris','merge-fruit','freecell','spider','minesweeper','maze']) {
        if (!['minesweeper','maze'].includes(id)) {
          await evaluate(`(async()=>{const m=await import('/src/games/${id==='2048'?'game-2048':id}/scene.ts');const C=Object.values(m).find(v=>typeof v==='function'&&v.prototype.create);if(!C.prototype.__audit){const create=C.prototype.create;C.prototype.create=function(){window.__legacy=this;return create.call(this)};C.prototype.__audit=true}})()`)
        }
        await evaluate(`document.querySelector('.game-grid [data-game="${id}"]').click()`)
        await until("!!document.querySelector('canvas')"); await pause(600)
        assert.ok(await evaluate("(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return c.width/r.width>=1.9 && c.height/r.height>=1.9})()"),`${id}: Retina backing buffer`)
        if (!['minesweeper','maze'].includes(id)) {
          const tap = await evaluate(`(()=>{const s=window.__legacy, method=['freecell','spider'].includes('${id}')?'restartDeal':'restart';window.__restarts=0;const original=s[method];s[method]=function(...args){window.__restarts++;return original.apply(this,args)};const t=s.children.list.find(o=>o.type==='Text'&&['重新开始','重开本局'].includes(o.text));const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+t.x*r.width/s.scale.width,y:r.y+t.y*r.height/s.scale.height}})()`)
          await send('Input.dispatchMouseEvent',{type:'mouseMoved',...tap})
          await send('Input.dispatchMouseEvent',{type:'mousePressed',...tap,button:'left',clickCount:1})
          await send('Input.dispatchMouseEvent',{type:'mouseReleased',...tap,button:'left',clickCount:1})
          await pause(200)
          assert.equal(await evaluate('window.__restarts'),1,`${id}: header control must remain clickable`)
        }
        const shot = await screenshot(`retina-${id}-${width}`)
        const black = await evaluate(`new Promise(resolve=>{const image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const r=document.querySelector('canvas').getBoundingClientRect();let black=0;for(let y=1;y<10;y++)for(let x=1;x<10;x++){const p=ctx.getImageData((r.x+r.width*x/10)*2,(r.y+r.height*y/10)*2,1,1).data;if(p[0]+p[1]+p[2]<10)black++}resolve(black)};image.src='data:image/png;base64,${shot}'})`)
        assert.ok(black<12,`${id}: render must fill the Retina buffer, black samples=${black}`)
        await evaluate('history.back()'); await until("!!document.querySelector('.game-grid')")
      }
    }
  } else {
  for(const [width,height] of [[768,1024],[1024,768]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:Number(process.env.DEVICE_SCALE ?? 1),mobile:false})
    await pause()
    console.log('ws-stage: enter')
    // 清掉历次回归残留的水排序草稿，保证进入默认基础档
    await evaluate(`(async()=>{const {saveDraft}=await import('/src/games/puzzle-kit/draft-storage.ts');saveDraft('water-sort',null);try{localStorage.removeItem('game-puzzle-draft-water-sort-v1')}catch(e){}return 1})()`)
    await open('water-sort')
    console.log('ws-stage: opened')
    // v1 异步 initialize（loadDraft 后 startFresh / 弹「继续上次吗」panel）
    await until("(__scene.state.colors > 0) || (!!__scene.overlay)")
    console.log('ws-stage: initialized')
    const resumeShown = await evaluate("JSON.stringify(!!__scene.overlay)") === 'true'
    if (resumeShown) {
      const hL = Number(await evaluate('JSON.stringify(__scene.scale.height)'))
      const raw = await evaluate(`(()=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect();return {x:r.x+384*r.width/768,y:r.y+(hL__placeholder__/2+42)*r.height/hL__placeholder__}})()`.replace(/hL__placeholder__/g, String(hL)))
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...raw});await pause(30)
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...raw,button:'left',clickCount:1});await pause(40)
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',...raw,button:'left',clickCount:1})
      await pause(1000)
    }
    await until("__scene.state.colors > 0")
    assert.equal(Number(await evaluate('JSON.stringify(__scene.state.colors)')),3)  // v1 默认基础档
    const wsH = Number(await evaluate('JSON.stringify(__scene.scale.height)'))
    const wsClick = async (lx, ly) => {
      const raw = await evaluate(`(()=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect();return {x:r.x+${lx}*r.width/768,y:r.y+${ly}*r.height/${wsH}}})()`)
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...raw});await pause(30)
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...raw,button:'left',clickCount:1});await pause(40)
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',...raw,button:'left',clickCount:1})
      await pause(800)
    }
    // Cozy UI：难度 pill 在 (384, topY)，点两下切到挑战 6 色
    const topY = Number(await evaluate('JSON.stringify(__scene.layout.topY)'))
    await wsClick(384, topY); await wsClick(384, topY)
    assert.equal(Number(await evaluate('JSON.stringify(__scene.state.colors)')),6)
    const pourPoints = await evaluate(`(async()=>{const {canPour}=await import('/src/games/water-sort/core/game.ts');const s=__scene.state;for(let a=0;a<s.tubes.length;a++)for(let b=0;b<s.tubes.length;b++)if(canPour(s,a,b)){const at=i=>{const view=__scene.tubeViews.get(i);const v=view?view.container:null;return v?{x:v.x,y:v.y}:null};const A=at(a),B=at(b);return (A&&B)?[A,B]:null}})()`)
    console.log('ws-stage: pourPoints', JSON.stringify(pourPoints))
    assert.ok(pourPoints)
    for(const p of pourPoints){ await wsClick(p.x, p.y) }
    console.log('ws-stage: poured')
    // 倒水动画跨排可达 ~1s，固定 900ms 会压线竞态；轮询等动画完成。
    await until("__scene.busy === false && __scene.state.moves >= 1")
    assert.equal(Number(await evaluate('JSON.stringify(__scene.state.moves)')),1)
    await screenshot(`water-sort-${width}`)
    const toolY = Number(await evaluate('JSON.stringify(__scene.layout.toolY)'))
    await wsClick(384-162, toolY)  // 撤销还原
    // 场景自身清档（saveDraft 同步清模块缓存），另一方向循环从基础档开始
    await evaluate(`(async()=>{const {saveDraft}=await import('/src/games/puzzle-kit/draft-storage.ts');saveDraft('water-sort',null);try{localStorage.removeItem('game-puzzle-draft-water-sort-v1')}catch(e){}return 1})()`)
    await wsClick(58, topY)  // v1 顶栏左上 Cozy 返回
    await until("!!document.querySelector('.game-grid')")
    // parking 段自己会动一步车并存 draft；不清档会让下一轮恢复出非初始局面，
    // 视图重建竞态时 carViews 缺失。开新局前显式清档并等视图就绪。
    await evaluate(`(async()=>{const {saveDraft}=await import('/src/games/puzzle-kit/draft-storage.ts');saveDraft('parking',null);try{localStorage.removeItem('game-puzzle-draft-parking-v1')}catch(e){}return 1})()`)
    await open('parking');await resumeOrFresh()
    await until(`__scene.state.cars.length>0 && __scene.state.cars.every(c=>!!__scene.carViews.get(c.id))`)
    assert.ok(await evaluate(`__scene.state.cars.every(c=>{const v=__scene.carViews.get(c.id);return v.x===110+(c.x+(c.horizontal?c.len/2:.5))*92&&v.y===235+(c.y+(c.horizontal?.5:c.len/2))*92})`))
    const carMove = await evaluate(`(async()=>{const {legalTargets}=await import('/src/games/parking/core/game.ts');for(const c of [...__scene.state.cars].reverse()){const targets=legalTargets(__scene.state,c.id);if(targets.length){const t=targets[0],v=__scene.carViews.get(c.id);return {x:v.x,y:v.y,tx:110+(c.horizontal?t+c.len/2:c.x+.5)*92,ty:235+(c.horizontal?c.y+.5:t+c.len/2)*92}}}})()`)
    assert.ok(carMove);await click(carMove.x,carMove.y);await click(carMove.tx,carMove.ty)
    assert.equal(await evaluate('__scene.state.moves'),1)
    await screenshot(`parking-${width}`);await home()
    await open('tile-match')
    // tile-match 是 portrait-fluid mount（逻辑高 960~1720 随宿主），全局 click 的
    // /900 换算在逻辑高 1024 时 y 系统性偏 13.8%，方块位置随机时会点飞；
    // 这里按场景实际逻辑高换算，按钮坐标从 layout 读取。
    const tmH = Number(await evaluate('JSON.stringify(__scene.scale.height)'))
    const tmClick = async (lx, ly) => {
      const raw = await evaluate(`(()=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect();return {x:r.x+${lx}*r.width/768,y:r.y+${ly}*r.height/${tmH}}})()`)
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...raw});await pause(30)
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...raw,button:'left',clickCount:1});await pause(40)
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',...raw,button:'left',clickCount:1})
      await pause(500)
    }
    await evaluate(`(async()=>{const {pick}=await import('/src/games/tile-match/core/game.ts');let s={tiles:Array.from({length:12},(_,id)=>({id,kind:Math.floor(id/3),layer:0,gx:id%4,gy:Math.floor(id/4)})),gone:[],slot:[],cleared:0,undoLog:[],undos:5,shuffles:1,won:false};for(const id of [0,1,3,4,6,7,9])s=pick(s,id).state;__scene.state=s;__scene.rebuildBoard(false)})()`)
    const tmBottom = Number(await evaluate('JSON.stringify(__scene.layout.bottomY)'))
    await tmClick(384, tmBottom)  // 工具行中央洗牌钮
    await until("__scene.busy === false")
    assert.equal(await evaluate('__scene.state.slot.length'),0)
    assert.equal(await evaluate('__scene.state.shuffles'),0)
    const tmPick = await evaluate(`(()=>{const id=__scene.available.values().next().value;const pos=__scene.boardPositions.get(id);const view=__scene.tileViews.get(id);return {x:pos.x,y:pos.y,loc:view?view.location:'none',free:view?view.free:null}})()`)
    assert.equal(tmPick.loc,'board');assert.equal(tmPick.free,true)
    await tmClick(tmPick.x,tmPick.y)
    await until(`__scene.state.slot.length===1`)
    await pause(300)
    await screenshot(`tile-match-${width}`)
    const tmTop = Number(await evaluate('JSON.stringify(__scene.layout.topY)'))
    await tmClick(58, tmTop)  // v3 顶栏左上返回（位置补丁 x=58）
    await until("!!document.querySelector('.game-grid')")
    await evaluate("document.querySelector('[data-category=logic]').click()")
    assert.equal(await evaluate("document.querySelectorAll('.game-card:not([hidden])').length"),6)
    await open('sudoku'); await resumeOrFresh(); await click(568,165)
    const cell = await evaluate('(()=>{const i=__scene.state.puzzle.indexOf(0),c=505/9;return {i,x:131.5+(i%9+.5)*c,y:225+(Math.floor(i/9)+.5)*c}})()')
    await click(cell.x,cell.y);await click(90,855);await click(77.333,780)
    assert.equal(await evaluate(`__scene.state.notes[${cell.i}][0]`),1)
    await click(382,855)
    assert.equal(await evaluate(`__scene.state.notes[${cell.i}].length`),0)
    await click(77.333,780)
    const saved = await evaluate('JSON.stringify(__scene.state)')
    await screenshot(`sudoku-${width}`)
    await home();await open('sudoku')
    assert.ok(await evaluate("__scene.message.includes('找到')"));await click(260,480)
    assert.equal(await evaluate('JSON.stringify(__scene.state)'),saved)
    assert.equal(await evaluate('__scene.audio.context.state'),'running')
    await click(680,45);await pause(200)
    assert.ok(await evaluate('__scene.audio.isMuted && __scene.audio.masterGain.gain.value<0.01'))
    await click(680,45);await pause(200)
    assert.ok(await evaluate('!__scene.audio.isMuted && __scene.audio.masterGain.gain.value>0.8'))
    await evaluate('window.__oldAudio=__scene.audio.context; window.__oldScene=__scene; true')
    await home()
    assert.equal(await evaluate('__oldAudio.state'),'closed')
    assert.equal(await evaluate('__oldScene.alive'),false)
    await open('nonogram');await resumeOrFresh()
    for(let i=0;i<9 && await evaluate('__scene.state.level!==5');i++)await click(608,850)
    assert.equal(await evaluate('__scene.state.level'),5)
    await click(384,850)
    const a=await point(226,256),b=await point(434,256)
    const objects=await evaluate('__scene.content.list.length')
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await pause(80)
    await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[b]});await pause(80)
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause()
    assert.ok(await evaluate('__scene.state.marks.slice(0,5).every(v=>v===1)'))
    assert.equal(await evaluate('__scene.history.length'),1)
    assert.equal(await evaluate('__scene.content.list.length'),objects)
    await screenshot(`nonogram-${width}`)
    await click(160,850);assert.ok(await evaluate('__scene.state.marks.every(v=>v===0)'))
    await home()
    await open('maze')
    const route=await evaluate("(async()=>{const {path}=await import('/src/games/maze/core/game.ts');return path(__scene.state).slice(0,9)})()")
    const mazePoint=async index=>{const size=await evaluate('__scene.state.size');return point(134+(index%size+.5)*500/size,230+(Math.floor(index/size)+.5)*500/size)}
    const mazeObjects=await evaluate('__scene.content.list.length')
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await mazePoint(route[0])]})
    for(const index of route.slice(1)){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[await mazePoint(index)]});await pause(40)}
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause()
    assert.equal(await evaluate('__scene.state.player'),route.at(-1))
    assert.equal(await evaluate('__scene.content.list.length'),mazeObjects)
    await screenshot(`maze-drag-${width}`);await home()
    await evaluate("document.querySelector('[data-category=all]').click()")
    await screenshot(`lobby-${width}`)
    await open('tangram');await click(135,210)
    for(let i=0;i<4;i++)await click(608,850)
    assert.equal(await evaluate('__scene.state.level'),4)
    await screenshot(`tangram-${width}`)
    for(let i=0;i<7;i++)await click(656,210)
    assert.ok(await evaluate('__scene.state.won'))
    await home()
    await evaluate('history.back()');await pause()
    assert.ok(await evaluate("document.querySelector('.exit-confirm')?.hidden===false"))
    await evaluate("document.querySelector('[data-exit-cancel]').click()")
    console.log(`${width}×${height}: 分类、输入、续玩、笔记、划格、撤销、音频、七巧板、退出确认通过`)
  }
  // 高难度操作和反复进出：不改变游戏规则、不注入测试局面。
  for(const [id,x,y] of [['memory',598,165],['pipes',639,165],['untangle',652,165],['maze',639,165],['bubbles',490,153],['sokoban',128,300]]){
    await open(id);await resumeOrFresh();await click(x,y)
    if(id==='memory'){await click(93,270);await click(176,270)}
    if(id==='pipes')await click(147,288)
    if(id==='maze')await click(384,850)
    if(id==='untangle')await click(384,850)
    if(id==='sokoban')await click(324,740)
    if(id==='bubbles')await click(384,350)
    await pause(600);await screenshot(`${id}-landscape`);await home()
  }
  await send('Emulation.setCPUThrottlingRate',{rate:4})
  await open('sudoku');await resumeOrFresh();await click(568,165)
  const durations=await evaluate('(()=>{const times=[];for(let i=0;i<20;i++){const start=performance.now();__scene.selected=i;__scene.draw();times.push(performance.now()-start)}return times.sort((a,b)=>a-b)})()')
  console.log('4 倍 CPU 降速下数独选格更新耗时（ms）:',JSON.stringify(durations))
  await send('Emulation.setCPUThrottlingRate',{rate:1});await home()
  await send('HeapProfiler.collectGarbage')
  const beforeCycles = await send('Memory.getDOMCounters')
  for(let i=0;i<8;i++){await open('sokoban');await home()}
  await send('HeapProfiler.collectGarbage')
  const afterCycles = await send('Memory.getDOMCounters')
  console.log('连续切换前/后的 DOM 与监听器数量:',JSON.stringify({beforeCycles,afterCycles}))
  assert.ok(afterCycles.jsEventListeners <= beforeCycles.jsEventListeners, '重复切换后监听器不应增长')
  // 刷新丢弃模块内缓存，再验证磁盘上的笔记和棋盘。
  await open('sudoku');await click(260,480)
  const blank = await evaluate('(()=>{const i=__scene.state.puzzle.indexOf(0),c=505/9;return {i,x:131.5+(i%9+.5)*c,y:225+(Math.floor(i/9)+.5)*c}})()')
  await click(blank.x,blank.y);await click(90,855);await click(77.333,780)
  assert.equal(await evaluate(`__scene.state.notes[${blank.i}][0]`),1)
  const beforeReload = await evaluate('JSON.stringify(__scene.state)')
  await home();await send('Page.reload');await until("!!document.querySelector('.game-grid [data-game=\"sudoku\"]')")
  await open('sudoku');assert.ok(await evaluate("__scene.message.includes('找到')"));await click(260,480)
  assert.equal(await evaluate('JSON.stringify(__scene.state)'),beforeReload)
  await home()
  for (const [width,height] of [[768,1024],[1024,768]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:Number(process.env.DEVICE_SCALE ?? 1),mobile:false})
    for (const id of ['pop-bubbles','red-rain','whack-mole','fruit-slicer']) {
      await open(id)
      if (id === 'fruit-slicer') await click(384, 508)
      else await click(160, 400)
      const listeners = await evaluate("__scene.input.listenerCount('pointerdown') + __scene.input.listenerCount('pointermove')")
      // 结算卡从底部滑入有 340ms 动画，等卡片就位再点「再来一次」。
      for(let i=0;i<3;i++) { await evaluate('__scene.endRound()'); await pause(600); await click(384,592) }
      assert.equal(await evaluate("__scene.input.listenerCount('pointerdown') + __scene.input.listenerCount('pointermove')"),listeners, `${id}: 重玩不能累积输入监听器`)
      await pause(1400)
      if(id==='pop-bubbles') {
        const bubble = await evaluate('__scene.state.bubbles[0]')
        assert.ok(bubble)
        await click(bubble.x,bubble.y)
        assert.equal(await evaluate('__scene.state.popped'),1)
        assert.ok(await evaluate('__scene.audio.context?.state === "running"'))
      }
      if(id==='red-rain') {
        await until('__scene.state.drops.some(d => !d.cracker && d.y > 270 && d.y < 780)')
        const drop = await evaluate('__scene.state.drops.find(d => !d.cracker && d.y > 270 && d.y < 780)')
        await click(drop.x,drop.y)
        assert.ok(await evaluate('__scene.state.score > 0'))
      }
      if(id==='whack-mole') {
        await until('__scene.state.holes.some(m => m && !m.sleeper)')
        const index = await evaluate('__scene.state.holes.findIndex(m => m && !m.sleeper)')
        await click(384+(index%3-1)*224,528+(Math.floor(index/3)-1)*224)
        assert.ok(await evaluate('__scene.state.score > 0'))
      }
      if(id==='fruit-slicer') {
        await until('__scene.state.fruits.some(f => !f.bomb && f.y > 300 && f.y < 740)')
        const fruit = await evaluate('__scene.state.fruits.find(f => !f.bomb && f.y > 300 && f.y < 740)')
        const from = await point(fruit.x-60,fruit.y), to = await point(fruit.x+60,fruit.y)
        await send('Input.dispatchMouseEvent',{type:'mousePressed',...from,button:'left',clickCount:1})
        await pause(250) // 刀光已经消失，手指仍按住；继续移动必须仍可切。
        assert.ok(await evaluate('__scene.lastPointer !== null && __scene.trail.length === 0'))
        const target = await evaluate('__scene.state.fruits.find(f => !f.bomb && f.y < 880)')
        assert.ok(target)
        const end = await point(target.x,target.y)
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',...end,button:'left',buttons:1})
        await send('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',clickCount:1})
        await pause(50)
        assert.ok(await evaluate('__scene.state.cut > 0'))
        assert.equal(await evaluate('__scene.lastPointer'),null)
        assert.ok(await evaluate("__scene.textures.getTextureKeys().filter(k=>k.startsWith('cut-half-')).length >= 2"))
        await screenshot(`fruit-slicer-cut-${width}`)
        await pause(900)
        assert.equal(await evaluate("__scene.textures.getTextureKeys().filter(k=>k.startsWith('cut-half-')).length"),0)
      }
      // 检查发射器局部坐标和有界粒子池；不改规则状态。
      const burst = await evaluate(`(()=>{__scene.makeDotTexture('test-dot',0xffffff);for(let i=0;i<20;i++)__scene.spray('test-dot',300,400,24,100);const e=__scene.bursts.get('test-dot');return {x:e.x,y:e.y,px:e.alive[0].x,py:e.alive[0].y,count:e.alive.length}})()`)
      assert.deepEqual([burst.x,burst.y,burst.px,burst.py],[0,0,300,400])
      assert.ok(burst.count<=64)
      await screenshot(`${id}-${width}`); await home()
    }
  }
  }
  assert.deepEqual(errors,[])
  const pictures = (await readdir(artifacts)).filter(name => name.endsWith('.png')).sort()
  await writeFile(join(artifacts, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>游戏屋 UI 截图审查</title><style>body{font-family:system-ui;background:#f3f0e7;color:#173f35;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}figure{margin:0;background:white;padding:12px;border-radius:16px}img{width:100%;height:auto}figcaption{padding:8px}</style><h1>游戏屋 UI 截图审查</h1><p>点击图片查看原尺寸。</p><main>${pictures.map(name => `<figure><figcaption>${name}</figcaption><a href="${name}"><img loading="lazy" src="${name}" alt="${name}"></a></figure>`).join('')}</main></html>`)
  console.log(`通过；截图目录：${artifacts}`)
} finally {
  ws?.close()
  const closed = new Promise(resolve => chrome.once('exit',resolve))
  chrome.kill()
  await Promise.race([closed,pause(3000)])
  await rm(profile,{recursive:true,force:true})
}
