import Phaser from 'phaser'
import { enableHighDpi } from '../../platform/display/high-dpi'
import { GameAudio } from '../../platform/audio/game-audio'
import { TileMatchScene } from './scene'

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
 * 叠叠消使用独立的 portrait-fluid mount：
 * - 保持 768 逻辑宽度，避免棋盘横向坐标体系漂移；
 * - 逻辑高度随宿主真实纵横比变化；
 * - FIT 的内部比例因此与宿主一致，手机上不再出现 768×900 letterbox。
 */
export const mount = (container: HTMLElement, exit: () => void): { destroy(): void } => {
  const audio = new GameAudio()
  const initialHeight = logicalHeight(container)

  // resize 期间即使 Phaser 尚未完成一次重排，也不露出应用层米色底。
  const previousBackground = container.style.background
  container.style.background = "#c88a4b url('art/tile-match-bg.png') center / cover no-repeat"

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: DESIGN_WIDTH,
    height: initialHeight,
    callbacks: { postBoot: enableHighDpi },
    scene: new TileMatchScene(audio, exit),
    backgroundColor: '#c88a4b',
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
      game.scale.setGameSize(DESIGN_WIDTH, next)
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
