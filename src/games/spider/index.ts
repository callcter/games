import Phaser from 'phaser'
import { GameAudio } from '../../platform/audio/game-audio'
import { SpiderScene } from './scene'

export async function mountSpider(container: HTMLElement, onExit: () => void): Promise<{ destroy: () => void }> {
  const audio = new GameAudio()
  let game: Phaser.Game | null = new Phaser.Game({
    type: Phaser.AUTO, parent: container, width: 1024, height: 768, backgroundColor: '#315b46',
    scene: new SpiderScene(audio, { onExit }),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: true }
  })
  return { destroy: () => { game?.destroy(true); game = null; audio.dispose() } }
}

