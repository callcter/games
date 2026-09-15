import Phaser from 'phaser'
import { GameAudio } from '../../platform/audio/game-audio'
import { MergeFruitScene } from './scene'

export interface MountedGame {
  destroy: () => void
}

export async function mountMergeFruit(container: HTMLElement, onExit: () => void): Promise<MountedGame> {
  const audio = new GameAudio()
  let game: Phaser.Game | null = null
  const scene = new MergeFruitScene(audio, { onExit })

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: 768,
    height: 1024,
    backgroundColor: '#f8f1df',
    scene,
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: 1.05 },
        // 支撑物合并消失后，休眠刚体不会仅凭重力自动醒来，会造成水果悬空。
        enableSleeping: false,
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      antialias: true,
      roundPixels: false
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
