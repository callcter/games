// Production gallery, isolated browser + explicit clean-game fixture.
// pnpm build && pnpm preview; then node scripts/capture-gallery.mjs.
import assert from 'node:assert/strict'
import { writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { allHelpTitles } from '../src/ui/help-content.ts'
import { withBrowser } from './lib/browser-session.mjs'

process.env.APP_URL = process.env.GALLERY_BASE ?? 'http://127.0.0.1:4173/'
const OUT = process.env.GALLERY_OUT ?? 'screenshots'
const GROUPS = [
  { name:'phone-390x844',width:390,height:844 },
  { name:'ipad-768x1024',width:768,height:1024 },
  { name:'ipad-1024x768',width:1024,height:768 }
]
const START = {
  'pop-bubbles':[160,414], 'red-rain':[160,414],
  'whack-mole':[160,414], 'fruit-slicer':[384,508], 'sokoban':[124,220]
}
const manifest = {
  sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  sourceDiffSha256:createHash('sha256').update(execFileSync('git',['diff','HEAD','--','src','scripts','vite.config.ts'])).digest('hex'),
  generatedAt:new Date().toISOString(),
  fixture:'isolated profile; fresh saves for each viewport; help already read; start base difficulty / first level',
  images:[]
}
await withBrowser(async ({send,evaluate,until,pause,base}) => {
  manifest.entrySha256=createHash('sha256').update(await (await fetch(base)).text()).digest('hex')
  const ids=await evaluate(`Array.from(document.querySelectorAll('.game-grid [data-game]'),e=>e.dataset.game)`)
  assert.equal(ids.length,24,'Unexpected registration count; review gallery coverage')
  const tapContent = async (x,y) => {
    const p=await evaluate(`(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),h=768*c.height/c.width,off=Math.max(0,Math.min(360,Math.round((h-900)*0.47)));return {x:r.x+${x}*r.width/768,y:r.y+(${y}+off)*r.height/h}})()`)
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]})
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  }
  for(const group of GROUPS) {
    await send('Emulation.setDeviceMetricsOverride',{width:group.width,height:group.height,deviceScaleFactor:2,mobile:group.name.startsWith('phone')})
    await send('Page.navigate',{url:base})
    await until("!!document.querySelector('.game-grid') && !document.querySelector('canvas')")
    // Clear only this script's isolated profile. No external CDP / user's saves are touched.
    await send('Storage.clearDataForOrigin',{origin:new URL(base).origin,storageTypes:'local_storage,indexeddb'})
    await evaluate(`localStorage.setItem('family-game-room-help-seen-v1',${JSON.stringify(JSON.stringify(allHelpTitles))})`)
    await send('Page.navigate',{url:base})
    await until("document.querySelectorAll('.game-grid [data-game]').length===24 && !document.querySelector('canvas')")
    const dir=join(OUT,group.name)
    await mkdir(dir,{recursive:true})
    const shot=async(id,state)=>{
      const hash=await evaluate('location.hash')
      assert.ok(id==='home' ? ['', '#/'].includes(hash) : hash===`#/${id}`, `Screenshot route mismatch: ${id} / ${hash}`)
      assert.ok(await evaluate("!document.querySelector('dialog[open]')"),'Unexpected modal obstructs gallery')
      assert.equal(await evaluate("!!document.querySelector('.game-grid')"),id==='home','Wrong screenshot page')
      const metrics=await send('Page.getLayoutMetrics')
      const height=id==='home'?Math.ceil(metrics.cssContentSize.height):group.height
      const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:group.width,height,scale:1}})
      await writeFile(join(dir,`${id}.png`),Buffer.from(result.data,'base64'))
      manifest.images.push({file:`${group.name}/${id}.png`,viewport:group,state,dpr:2})
      console.log(`${group.name}/${id}: ${state}`)
    }
    await pause(300)
    await shot('home','lobby: continue + categories + library preview')
    for(const id of ids) {
      await evaluate(`document.querySelector('.game-grid [data-game="${id}"]').click()`)
      await until(`location.hash==='#/${id}' && !!document.querySelector('canvas') && !document.querySelector('.game-grid')`)
      // Allow local texture decoding and entrance animation; timeouts above are failures.
      await pause(1800)
      if(START[id]) { await tapContent(...START[id]); await pause(1600) }
      assert.ok(await evaluate(`performance.getEntriesByType('resource').every(e=>!new URL(e.name).pathname.startsWith('/src/'))`),'Gallery must use production assets')
      await shot(id,START[id]?'fresh game after start tap':'fresh board')
      await evaluate('history.back()')
      await until("!!document.querySelector('.game-grid') && !document.querySelector('canvas')")
    }
  }
})
assert.equal(manifest.images.length,75)
await writeFile(join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(`Captured ${manifest.images.length} images; visual review still required.`)
