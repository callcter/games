import Phaser from 'phaser'
import { enableHighDpi } from '../../platform/display/high-dpi'
import { GameAudio } from '../../platform/audio/game-audio'
import { loadGameSave, saveGame } from '../../platform/storage/game-storage'
import { newGame, restoreGame, type SpiderState } from './core/game'
import { SpiderScene } from './scene'

const SAVE_KEY = 'spider-v1'

interface SaveEnvelope {
  schemaVersion: 1
  state: SpiderState
  initialDeal: SpiderState
}

export async function mountSpider(container: HTMLElement, onExit: () => void): Promise<{ destroy: () => void }> {
  const saved = restoreSave(await loadGameSave<unknown>(SAVE_KEY))
  const initialDeal = saved?.initialDeal ?? newGame()
  const initialState = saved?.state ?? initialDeal
  const audio = new GameAudio()
  let game: Phaser.Game | null = new Phaser.Game({
    callbacks: { postBoot: enableHighDpi },
    type: Phaser.AUTO, parent: container, width: 1024, height: 768, backgroundColor: '#315b46',
    scene: new SpiderScene(audio, {
      onExit,
      onStateChange: (state, deal) => void saveGame(SAVE_KEY, { schemaVersion: 1, state, initialDeal: deal } satisfies SaveEnvelope)
    }, initialState, initialDeal),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: true }
  })
  return { destroy: () => { game?.destroy(true); game = null; audio.dispose() } }
}

function restoreSave(value: unknown): SaveEnvelope | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<SaveEnvelope>
  if (candidate.schemaVersion !== 1) return null
  const state = restoreGame(candidate.state)
  const initialDeal = restoreGame(candidate.initialDeal)
  return state && initialDeal ? { schemaVersion: 1, state, initialDeal } : null
}
