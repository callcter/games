import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameAudio } from '../../src/platform/audio/game-audio'

const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
const makeSource = () => ({ frequency: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null })
let contexts: FakeContext[]
let initialState: string
class FakeContext {
  state = initialState
  currentTime = 0
  sampleRate = 100
  destination = {}
  sources: ReturnType<typeof makeSource>[] = []
  resume = vi.fn(async () => { this.state = 'running' })
  suspend = vi.fn(async () => { this.state = 'suspended' })
  close = vi.fn(async () => { this.state = 'closed' })
  constructor() { contexts.push(this) }
  createGain() { return { gain: param(), connect: vi.fn(), disconnect: vi.fn() } }
  createOscillator() {
    const source = makeSource()
    this.sources.push(source)
    return source
  }
  createBufferSource() { return this.createOscillator() }
  createBuffer() { return { getChannelData: () => new Float32Array(100) } }
  createBiquadFilter() { return { frequency: param(), Q: param(), connect: vi.fn(), disconnect: vi.fn() } }
}
beforeEach(() => {
  contexts = []
  initialState = 'running'
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeContext)
  vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('window', { setInterval, clearInterval, localStorage: { getItem: () => null, setItem: vi.fn() } })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('声音生命周期和连续反馈', () => {
  it('释放后不能再解锁或创建音乐计时器', async () => {
    const audio = new GameAudio()
    audio.dispose()
    await audio.unlock()
    expect(contexts).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('等待 Safari 解锁期间离开游戏，不会重启音乐', async () => {
    initialState = 'suspended'
    let finish!: () => void
    const resume = vi.spyOn(FakeContext.prototype, 'createGain')
    resume.mockImplementation(function (this: FakeContext) {
      this.resume.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
      return { gain: param(), connect: vi.fn(), disconnect: vi.fn() }
    })
    const audio = new GameAudio()
    const pending = audio.unlock()
    audio.dispose(); finish(); await pending
    expect(vi.getTimerCount()).toBe(0)
    expect(contexts[0]!.sources).toHaveLength(0)
    resume.mockRestore()
  })
  it('高频点击限制同时发声，结束后断开节点并允许新声音', async () => {
    const audio = new GameAudio()
    await audio.unlock()
    const ctx = contexts[0]!
    for (let i = 0; i < 100; i++) audio.playPop()
    expect(ctx.sources.length).toBeLessThanOrEqual(24)
    const count = ctx.sources.length
    ctx.sources.forEach(source => source.onended?.())
    expect(ctx.sources.every(source => source.disconnect.mock.calls.length > 0)).toBe(true)
    audio.playPop()
    expect(ctx.sources.length).toBeGreaterThan(count)
    audio.dispose()
  })
  it('静音和后台不新增音效', async () => {
    const audio = new GameAudio()
    await audio.unlock()
    const ctx = contexts[0]!, before = ctx.sources.length
    audio.toggleMuted(); audio.playPop(); audio.playWin()
    vi.advanceTimersByTime(1500)
    expect(ctx.sources).toHaveLength(before)
    audio.toggleMuted(); ctx.state = 'suspended'; audio.playPop()
    expect(ctx.sources).toHaveLength(before)
    audio.dispose()
  })
})
