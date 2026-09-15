const MUTE_STORAGE_KEY = 'family-game-room-muted'
const MELODY = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 392]

export class GameAudio {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private effectsGain: GainNode | null = null
  private musicTimer: number | null = null
  private melodyIndex = 0
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
    this.createGraph()
    if (!this.context) return
    if (this.context.state === 'suspended') await this.context.resume()
    this.startMusic()
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
    this.playEffect(190, 245, 0.07, 0.035, 'sine')
  }

  playMerge(): void {
    this.playEffect(370, 620, 0.16, 0.075, 'triangle')
  }

  playWin(): void {
    ;[0, 0.11, 0.22].forEach((delay, index) => {
      const notes = [523.25, 659.25, 783.99]
      this.playEffect(notes[index] ?? 523.25, notes[index] ?? 523.25, 0.28, 0.065, 'triangle', delay)
    })
  }

  playGameOver(): void {
    this.playEffect(330, 165, 0.45, 0.055, 'sine')
  }

  playRestart(): void {
    this.playEffect(260, 420, 0.2, 0.05, 'triangle')
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer)
    this.musicTimer = null
    if (this.context && this.context.state !== 'closed') void this.context.close()
    this.context = null
  }

  private createGraph(): void {
    if (this.context) return
    this.context = new AudioContext()
    this.masterGain = this.context.createGain()
    this.musicGain = this.context.createGain()
    this.effectsGain = this.context.createGain()
    this.musicGain.gain.value = 0.16
    this.effectsGain.gain.value = 0.7
    this.musicGain.connect(this.masterGain)
    this.effectsGain.connect(this.masterGain)
    this.masterGain.connect(this.context.destination)
    this.applyMute()
  }

  private applyMute(): void {
    if (!this.context || !this.masterGain) return
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.context.currentTime, 0.025)
  }

  private startMusic(): void {
    if (this.musicTimer !== null) return
    this.playNextMusicNote()
    this.musicTimer = window.setInterval(() => this.playNextMusicNote(), 460)
  }

  private playNextMusicNote(): void {
    if (!this.context || !this.musicGain || this.context.state !== 'running') return
    const frequency = MELODY[this.melodyIndex % MELODY.length] ?? 261.63
    this.melodyIndex += 1
    this.scheduleTone(frequency, frequency * 0.998, 0.34, 0.055, 'sine', this.musicGain)
    if (this.melodyIndex % 4 === 1) {
      this.scheduleTone(frequency / 2, frequency / 2, 0.7, 0.035, 'triangle', this.musicGain)
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
    if (!this.context || !this.effectsGain || this.muted) return
    this.scheduleTone(startFrequency, endFrequency, duration, volume, type, this.effectsGain, delay)
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
    if (!this.context) return
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
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }
}

function readMutedPreference(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}
