import Phaser from 'phaser'
import { GameAudio } from '../../platform/audio/game-audio'
import { FreeCellScene } from './scene'

export async function mountFreeCell(container: HTMLElement, onExit: () => void): Promise<{ destroy: () => void }> {
  const audio = new GameAudio()
  let game: Phaser.Game | null = new Phaser.Game({
    type: Phaser.AUTO, parent: container, width: 1024, height: 768, backgroundColor: '#23614f',
    scene: new FreeCellScene(audio, { onExit }),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: true }
  })
  return { destroy: () => { game?.destroy(true); game = null; audio.dispose() } }
}

