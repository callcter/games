import Phaser from 'phaser'
import { GameAudio } from '../../platform/audio/game-audio'
import { MinesweeperScene } from './scene'

export async function mountMinesweeper(container: HTMLElement, onExit: () => void): Promise<{ destroy: () => void }> {
  const audio = new GameAudio()
  let game: Phaser.Game | null = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: 768,
    height: 1024,
    backgroundColor: '#e9dfca',
    scene: new MinesweeperScene(audio, { onExit }),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: true }
  })

  return {
    destroy: () => {
      game?.destroy(true)
      game = null
      audio.dispose()
    }
  }
}
