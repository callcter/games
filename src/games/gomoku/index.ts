import Phaser from 'phaser'
import { enableHighDpi } from '../../platform/display/high-dpi'
import { GameAudio } from '../../platform/audio/game-audio'
import { measureGameViewport } from '../../platform/display/game-viewport'
import { GomokuScene } from './scene'

export interface MountedGame {
  destroy: () => void
}

export async function mountGomoku(container: HTMLElement, onExit: () => void): Promise<MountedGame> {
  const audio = new GameAudio()
  let game: Phaser.Game | null = null
  const scene = new GomokuScene(audio, { onExit })
  const viewport = measureGameViewport(container)

  game = new Phaser.Game({
    type: Phaser.AUTO,
    callbacks: { postBoot: enableHighDpi },
    parent: container,
    width: viewport.width,
    height: viewport.height,
    backgroundColor: '#f8f1df',
    scene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      antialias: true,
      roundPixels: true
    }
  })

  return {
    destroy: () => {
      game?.destroy(true)
      game = null
      audio.dispose()
    }
  }
}
