const MUTE_STORAGE_KEY = 'family-game-room-muted'
const MELODY = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 392]

export class GameAudio {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private effectsGain: GainNode | null = null
  private musicTimer: number | null = null
  private melodyIndex = 0
  private started = false
  private disposed = false
  private voices = new Set<() => void>()
  private noiseBuffer: AudioBuffer | null = null
  private muted = readMutedPreference()
  private readonly handleVisibilityChange = (): void => {
    if (!this.context) return
    if (document.hidden) void this.context.suspend()
    else if (!this.muted) void this.context.resume()
  }

  constructor() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  get isMuted(): boolean {
    return this.muted
  }

  async unlock(): Promise<void> {
    if (this.disposed) return
    try {
      this.createGraph()
      const context = this.context
      if (!context) return
      if (context.state !== 'running') await context.resume()
      if (this.disposed || this.context !== context) return
      if (!this.started) {
        this.started = true
        this.startMusic()
        this.playEffect(520, 680, 0.16, 0.14, 'triangle')
      }
    } catch (error) {
      console.warn('浏览器暂时没有允许播放声音。', error)
    }
  }

  toggleMuted(): void {
    this.muted = !this.muted
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, String(this.muted))
    } catch {
      // 某些隐私模式不允许持久化偏好，但本次会话仍可正常静音。
    }
    this.applyMute()
    if (!this.muted) void this.unlock()
  }

  playMove(): void {
    this.playEffect(190, 260, 0.08, 0.12, 'sine')
  }

  playMerge(): void {
    this.playEffect(370, 660, 0.18, 0.2, 'triangle')
  }

  playWin(): void {
    ;[0, 0.11, 0.22].forEach((delay, index) => {
      const notes = [523.25, 659.25, 783.99]
      this.playEffect(notes[index] ?? 523.25, notes[index] ?? 523.25, 0.28, 0.16, 'triangle', delay)
    })
  }

  playGameOver(): void {
    this.playEffect(330, 165, 0.45, 0.14, 'sine')
  }

  playRestart(): void {
    this.playEffect(260, 420, 0.2, 0.14, 'triangle')
  }

  playPlace(player: 1 | 2): void {
    const frequency = player === 1 ? 180 : 260
    this.playEffect(frequency, frequency * 0.82, 0.1, 0.14, 'sine')
  }

  /** 泡泡破裂的「啵」声；pitch 越大越清脆，可随泡泡大小映射音阶。 */
  playPop(pitch = 1): void {
    const safePitch = Number.isFinite(pitch) ? Math.min(3, Math.max(0.35, pitch)) : 1
    this.playEffect(760 * safePitch, 220 * safePitch, 0.09, 0.13, 'sine')
    this.playNoise(500 * safePitch, 2600 * safePitch, 0.065, 0.09, 'lowpass')
  }

  /** 炸弹或炮仗的低沉「砰」声。 */
  playBurst(): void {
    this.playNoise(1000, 120, 0.3, 0.3, 'lowpass')
  }

  /** 刀风「唰」声，用于滑动切水果。 */
  playWhoosh(): void {
    this.playNoise(500, 3600, 0.16, 0.16, 'bandpass')
  }

  dispose(): void {
    this.disposed = true
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer)
    this.musicTimer = null
    if (this.context && this.context.state !== 'closed') void this.context.close()
    this.context = null
    for (const release of this.voices) release()
    this.masterGain = this.musicGain = this.effectsGain = null
    this.noiseBuffer = null
  }

  private createGraph(): void {
    if (this.context) return
    this.context = new AudioContext()
    this.masterGain = this.context.createGain()
    this.musicGain = this.context.createGain()
    this.effectsGain = this.context.createGain()
    this.musicGain.gain.value = 0.34
    this.effectsGain.gain.value = 1
    this.musicGain.connect(this.masterGain)
    this.effectsGain.connect(this.masterGain)
    this.masterGain.connect(this.context.destination)
    this.applyMute()
  }

  private applyMute(): void {
    if (!this.context || !this.masterGain) return
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.context.currentTime, 0.025)
  }

  private startMusic(): void {
    if (this.musicTimer !== null) return
    this.playNextMusicNote()
    this.musicTimer = window.setInterval(() => this.playNextMusicNote(), 460)
  }

  private playNextMusicNote(): void {
    if (!this.context || !this.musicGain || this.context.state !== 'running' || this.muted) return
    const frequency = MELODY[this.melodyIndex % MELODY.length] ?? 261.63
    this.melodyIndex += 1
    this.scheduleTone(frequency, frequency * 0.998, 0.34, 0.11, 'sine', this.musicGain)
    if (this.melodyIndex % 4 === 1) {
      this.scheduleTone(frequency / 2, frequency / 2, 0.7, 0.065, 'triangle', this.musicGain)
    }
  }

  private playEffect(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    delay = 0
  ): void {
    if (!this.context || !this.effectsGain || this.muted || this.context.state !== 'running') return
    this.scheduleTone(startFrequency, endFrequency, duration, volume, type, this.effectsGain, delay)
  }

  // 白噪声经滤波器扫频，补足振荡器做不出的「破裂/爆炸/风声」质感。
  private playNoise(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    filterType: BiquadFilterType
  ): void {
    if (!this.context || !this.effectsGain || this.muted || this.context.state !== 'running' || this.voices.size >= 24) return
    if (!this.noiseBuffer) {
      const rate = this.context.sampleRate
      this.noiseBuffer = this.context.createBuffer(1, rate, rate)
      const data = this.noiseBuffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    const start = this.context.currentTime
    const source = this.context.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true
    const filter = this.context.createBiquadFilter()
    filter.type = filterType
    filter.Q.value = filterType === 'bandpass' ? 1.4 : 0.8
    filter.frequency.setValueAtTime(startFrequency, start)
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration)
    const envelope = this.context.createGain()
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(this.effectsGain)
    this.trackVoice(source, filter, envelope)
    source.start(start)
    source.stop(start + duration + 0.02)
  }

  private scheduleTone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    destination: AudioNode,
    delay = 0
  ): void {
    if (!this.context || this.voices.size >= 24) return
    const start = this.context.currentTime + delay
    const oscillator = this.context.createOscillator()
    const envelope = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(startFrequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration)
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.018)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(envelope)
    envelope.connect(destination)
    this.trackVoice(oscillator, envelope)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  private trackVoice(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
    const release = (): void => {
      source.onended = null
      source.disconnect()
      nodes.forEach(node => node.disconnect())
      this.voices.delete(release)
    }
    source.onended = release
    this.voices.add(release)
  }
}

function readMutedPreference(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}
