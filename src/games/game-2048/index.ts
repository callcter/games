import Phaser from 'phaser'
import { GameAudio } from '../../platform/audio/game-audio'
import { loadGameSave, saveGame } from '../../platform/storage/game-storage'
import { newGame, restoreGame, type Game2048State } from './core/game'
import { Game2048Scene } from './scene'

const SAVE_KEY = 'game-2048-v1'

interface SaveEnvelope {
  schemaVersion: 1
  state: Game2048State
}

export interface MountedGame {
  destroy: () => void
}

export async function mount2048(container: HTMLElement, onExit: () => void): Promise<MountedGame> {
  const savedValue = await loadGameSave<unknown>(SAVE_KEY)
  const initialState = restoreSavedState(savedValue) ?? newGame()
  let game: Phaser.Game | null = null
  const audio = new GameAudio()

  const scene = new Game2048Scene(initialState, audio, {
    onExit: () => onExit(),
    onStateChange: (state: Game2048State) => {
      const save: SaveEnvelope = { schemaVersion: 1, state }
      void saveGame(SAVE_KEY, save)
    }
  })

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

function restoreSavedState(value: unknown): Game2048State | null {
  if (value && typeof value === 'object' && 'schemaVersion' in value && 'state' in value) {
    const save = value as Partial<SaveEnvelope>
    if (save.schemaVersion !== 1) return null
    return restoreGame(save.state)
  }
  return restoreGame(value)
}
