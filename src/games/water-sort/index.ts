import Phaser from 'phaser'
import { enableHighDpi } from '../../platform/display/high-dpi'
import { GameAudio } from '../../platform/audio/game-audio'
import { WaterSortScene } from './scene'

const DESIGN_WIDTH = 768
const MIN_HEIGHT = 960
const MAX_HEIGHT = 1720

function logicalHeight(host: HTMLElement): number {
  const rect = host.getBoundingClientRect()
  const width = Math.max(1, rect.width || window.innerWidth || DESIGN_WIDTH)
  const height = Math.max(1, rect.height || window.innerHeight || MIN_HEIGHT)
  return Math.round(Phaser.Math.Clamp(DESIGN_WIDTH * height / width, MIN_HEIGHT, MAX_HEIGHT))
}

/**
 * Water Sort owns a portrait-fluid mount instead of the generic 768×900 puzzle mount.
 * Keeping the logical width fixed preserves touch/layout math while matching the host
 * aspect ratio, so tall phones no longer show large letterbox bands.
 */
export const mount = (container: HTMLElement, exit: () => void): { destroy(): void } => {
  const audio = new GameAudio()
  const initialHeight = logicalHeight(container)
  const previousBackground = container.style.background

  container.style.background =
    "#c58b52 url('art/water-sort-bg.jpg') center / cover no-repeat"

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: DESIGN_WIDTH,
    height: initialHeight,
    callbacks: { postBoot: enableHighDpi },
    scene: new WaterSortScene(audio, exit),
    backgroundColor: '#c58b52',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      antialias: true,
      roundPixels: true
    }
  })

  let lastHeight = initialHeight
  let raf = 0

  const resize = (): void => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const next = logicalHeight(container)
      if (Math.abs(next - lastHeight) < 2) return
      lastHeight = next
      game.scale.resize(DESIGN_WIDTH, next)
    })
  }

  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(resize)
    : null

  observer?.observe(container)
  window.addEventListener('orientationchange', resize)
  window.visualViewport?.addEventListener('resize', resize)

  return {
    destroy() {
      observer?.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('orientationchange', resize)
      window.visualViewport?.removeEventListener('resize', resize)
      container.style.background = previousBackground
      game.destroy(true)
      audio.dispose()
    }
  }
}
