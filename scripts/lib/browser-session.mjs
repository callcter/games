// 无额外依赖。先运行 pnpm dev，再运行 pnpm test:browser。
// 独立临时 Chrome 配置，不读取或修改平时浏览器的存档。
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function withBrowser(run) {
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
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry)
    const callback = waiting.get(message.id)
    if (callback) { clearTimeout(callback.timer); waiting.delete(message.id); message.error ? callback.reject(message.error) : callback.resolve(message.result) }
  }
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const until = async expression => {
    // 无头 Chrome 的 rAF 节流随机器负载波动极大（700ms 场景定时器实测可拖到 >10s）；
    // 线上首次预缓存含本地图集，等待预算再放宽一倍。等待上限不是断言强度。
    for(let i=0;i<(process.env.PRODUCTION_ONLY ? 600 : 300);i++){
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
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2})
  await send('Page.navigate',{url:base})
  await until("!!document.querySelector('.game-grid')")
  try { await run({send,evaluate,until,screenshot,pause,base}) }
  catch (error) { await screenshot('failure'); console.error(`失败证据：${artifacts}`); throw error }
  assert.deepEqual(errors,[])
  console.log(`通过；截图目录：${artifacts}`)
} finally {
  ws?.close()
  const closed = new Promise(resolve => chrome.once('exit',resolve))
  chrome.kill()
  await Promise.race([closed,pause(3000)])
  await rm(profile,{recursive:true,force:true})
}

}
