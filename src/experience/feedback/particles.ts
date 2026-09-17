import Phaser from 'phaser'

/** 同时存活的短粒子硬上限（方案 §54.2 预算：尽量 < 80）。 */
const MAX_ALIVE = 80

export interface BurstOptions {
  x: number
  y: number
  count: number
  /** 散开速度上限，默认 220。 */
  speed?: number
  lifespanMs?: number
  /** 0xRRGGBB，多色传数组。 */
  tint?: number | number[]
  gravityY?: number
  /** 粒子尺寸基准，默认 5px 半径。 */
  radius?: number
}

export interface BurstPool {
  burst(options: BurstOptions): void
  destroy(): void
}

const pools = new WeakMap<Phaser.Scene, Map<string, Phaser.GameObjects.Particles.ParticleEmitter>>()

function dotTexture(scene: Phaser.Scene, radius: number): string {
  const key = `experience-dot-${radius}`
  if (!scene.textures.exists(key)) {
    const graphics = scene.make.graphics()
    graphics.fillStyle(0xffffff)
    graphics.fillCircle(radius, radius, radius)
    graphics.generateTexture(key, radius * 2, radius * 2)
    graphics.destroy()
  }
  return key
}

/** 白点纹理 + tint 的粒子爆发池：同场景同尺寸复用一个 emitter，总数受 MAX_ALIVE 约束。 */
export function createBurstPool(scene: Phaser.Scene): BurstPool {
  let pool = pools.get(scene)
  if (!pool) {
    pool = new Map()
    pools.set(scene, pool)
  }
  const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []
  return {
    burst({ x, y, count, speed = 220, lifespanMs = 560, tint = 0xfff3c4, gravityY = 160, radius = 5 }: BurstOptions): void {
      const key = `${radius}`
      let emitter = pool!.get(key)
      if (!emitter || !emitter.active) {
        emitter = scene.add.particles(0, 0, dotTexture(scene, radius), {
          speed: { min: speed * 0.35, max: speed },
          lifespan: lifespanMs,
          scale: { start: 1, end: 0.2 },
          alpha: { start: 0.9, end: 0 },
          gravityY,
          tint,
          maxAliveParticles: MAX_ALIVE,
          emitting: false
        })
        emitter.setDepth(1500)
        pool!.set(key, emitter)
        emitters.push(emitter)
      }
      if (tint !== undefined) emitter.setParticleTint(tint)
      emitter.explode(Math.min(count, MAX_ALIVE), x, y)
    },
    destroy(): void {
      for (const emitter of emitters) emitter.destroy()
      emitters.length = 0
    }
  }
}
