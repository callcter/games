import Phaser from 'phaser'
import { enableHighDpi } from '../../platform/display/high-dpi'
import { GameAudio } from '../../platform/audio/game-audio'

export function mountPuzzle(container: HTMLElement, exit: () => void, make: (audio: GameAudio, exit: () => void) => Phaser.Scene): { destroy(): void } {
  const audio = new GameAudio()
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: container, width: 768, height: 900,
    callbacks: { postBoot: enableHighDpi },
    scene: make(audio, exit), backgroundColor: '#f8f1df',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: true }
  })
  return { destroy() { game.destroy(true); audio.dispose() } }
}
