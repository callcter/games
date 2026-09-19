import Phaser from 'phaser'
import { enableHighDpi } from '../../platform/display/high-dpi'
import { measureGameViewport } from '../../platform/display/game-viewport'
import { GameAudio } from '../../platform/audio/game-audio'
import { preloadGameUi } from '../../ui'

const DESIGN_WIDTH = 768
const BASE_HEIGHT = 900
const MAX_PORTRAIT_HEIGHT = 1680

function logicalHeightFor(container: HTMLElement): number {
  const viewport = measureGameViewport(container)
  if (viewport.width <= 0) return BASE_HEIGHT

  // 横屏继续使用旧 768×900 FIT 语义；竖屏按真实宿主纵横比扩高，
  // 因此 390×844 手机约得到 768×1662，Canvas 不再只占屏幕中间一截。
  const height = Math.round(DESIGN_WIDTH * viewport.height / viewport.width)
  return Phaser.Math.Clamp(height, BASE_HEIGHT, MAX_PORTRAIT_HEIGHT)
}

class PuzzleUiBootScene extends Phaser.Scene {
  constructor(private readonly targetKey: string) {
    super({ key: `${targetKey}-ui-boot` })
  }

  preload(): void {
    preloadGameUi(this)
  }

  create(): void {
    this.scene.start(this.targetKey)
  }
}

export function mountPuzzle(
  container: HTMLElement,
  exit: () => void,
  make: (audio: GameAudio, exit: () => void) => Phaser.Scene
): { destroy(): void } {
  const audio = new GameAudio()
  const gameplay = make(audio, exit)
  const targetKey = gameplay.sys.settings.key
  let currentHeight = logicalHeightFor(container)

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: DESIGN_WIDTH,
    height: currentHeight,
    callbacks: { postBoot: enableHighDpi },
    scene: [new PuzzleUiBootScene(targetKey), gameplay],
    backgroundColor: '#f8f1df',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      antialias: true,
      roundPixels: true
    }
  })

  let frame = 0
  const syncSize = (): void => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const nextHeight = logicalHeightFor(container)
      if (nextHeight === currentHeight) return
      currentHeight = nextHeight
      game.scale.resize(DESIGN_WIDTH, currentHeight)
    })
  }

  const observer = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(syncSize)

  observer?.observe(container)
  window.addEventListener('resize', syncSize)
  window.addEventListener('orientationchange', syncSize)

  return {
    destroy(): void {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', syncSize)
      window.removeEventListener('orientationchange', syncSize)
      game.destroy(true)
      audio.dispose()
    }
  }
}
