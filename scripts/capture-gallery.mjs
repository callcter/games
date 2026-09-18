// 全量截图：大厅 + 所有游戏在手机 / iPad 竖屏 / iPad 横屏三组视口下的画面。
// 用本地生产构建（pnpm preview）+ 独立配置的 CDP Chrome，输出到 screenshots/。
// 用法：先 pnpm build && pnpm preview，再 node scripts/capture-gallery.mjs
// 给 GPT 做 UI 审计用（AGENTS.md 10.3：用完关闭本脚本依赖的进程）。
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const OUT = join(root, '..', 'screenshots')
const BASE = process.env.GALLERY_BASE ?? 'http://localhost:4173/'
const CDP = process.env.GALLERY_CDP ?? 'http://localhost:9222'

// 三组视口：手机主流、iPad 竖屏、iPad 横屏（AGENTS.md 5.2 的验收尺寸）。
const GROUPS = [
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'ipad-768x1024', width: 768, height: 1024 },
  { name: 'ipad-1024x768', width: 1024, height: 768 }
]

// 动作游戏进入后先选难度，才能截到真实回合画面（action-kit 768×900 逻辑坐标）。
const ACTION_START = {
  'pop-bubbles': [160, 400],
  'red-rain': [160, 400],
  'whack-mole': [160, 400],
  'fruit-slicer': [384, 508]
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const res = await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })
const page = await res.json()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad })
let seq = 0
const pending = new Map()
ws.onmessage = ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq
  pending.set(id, m => m.error ? reject(new Error(method + ': ' + JSON.stringify(m.error))) : resolve(m.result))
  ws.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(String(r.exceptionDetails.exception?.description ?? expression).slice(0, 300))
  return r.result.value
}
const shot = async (w, h, file) => {
  // 大厅可能超出一屏，按内容全高截；游戏页一律视口尺寸。
  const metrics = await send('Page.getLayoutMetrics')
  const contentH = Math.min(metrics.cssContentSize?.height ?? h, 20000)
  const beyond = contentH > h + 40
  const result = await send('Page.captureScreenshot', beyond
    ? { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: contentH, scale: 1 } }
    : { format: 'png' })
  await writeFile(file, Buffer.from(result.data, 'base64'))
}
const canvasClick = async (lx, ly) => {
  const raw = await evaluate(`(()=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect();return {x:r.x+${lx}*r.width/768,y:r.y+${ly}*r.height/900}})()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...raw })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...raw, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...raw, button: 'left', clickCount: 1 })
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })

// 游戏清单以大厅实际注册为准，避免与 app 注册表漂移。
await send('Page.navigate', { url: BASE })
for (let i = 0; i < 60; i++) {
  const ready = await evaluate(`document.querySelectorAll('.game-grid [data-game]').length >= 24`).catch(() => false)
  if (ready) break
  await sleep(250)
}
const ids = await evaluate(`Array.from(document.querySelectorAll('.game-grid [data-game]'), e => e.dataset.game)`)
console.log(`大厅注册 ${ids.length} 款游戏`)

for (const group of GROUPS) {
  const dir = join(OUT, group.name)
  await mkdir(dir, { recursive: true })
  await send('Emulation.setDeviceMetricsOverride', { width: group.width, height: group.height, deviceScaleFactor: 2, mobile: group.name.startsWith('phone') })
  await sleep(1200)
  await shot(group.width, group.height, join(dir, 'home.png'))
  console.log(`[${group.name}] home ✓`)

  for (const id of ids) {
    await send('Page.navigate', { url: `${BASE}#/${id}` })
    for (let i = 0; i < 40; i++) {
      const ready = await evaluate(`!!document.querySelector('canvas')`).catch(() => false)
      if (ready) break
      await sleep(250)
    }
    await sleep(2600)  // 等入场动画与首帧布局
    if (ACTION_START[id]) {
      await canvasClick(...ACTION_START[id])
      await sleep(2200)  // 等回合实体出现
    }
    await shot(group.width, group.height, join(dir, `${id}.png`))
    console.log(`[${group.name}] ${id} ✓`)
  }
}

await fetch(`${CDP}/json/close/${page.id}`).catch(() => {})
ws.close()
console.log(`完成：${OUT}（${GROUPS.length} 组 × 大厅+${ids.length} 游戏）`)
