import Phaser from 'phaser'
import { GameAudio } from '../../platform/audio/game-audio'
import { TetrisScene } from './scene'

export interface MountedGame {
  destroy: () => void
}

export async function mountTetris(container: HTMLElement, onExit: () => void): Promise<MountedGame> {
  const audio = new GameAudio()
  let game: Phaser.Game | null = null
  const scene = new TetrisScene(audio, { onExit })

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: container.clientWidth,
    height: container.clientHeight,
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

