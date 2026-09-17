import Phaser from 'phaser'
import { enableHighDpi } from '../../platform/display/high-dpi'
import { GameAudio } from '../../platform/audio/game-audio'
import { loadGameSave, saveGame } from '../../platform/storage/game-storage'
import { newDeal, type KlondikeState } from './core/game'
import { KlondikeScene } from './scene'

const SAVE_KEY = 'klondike-v1'

interface SaveEnvelope {
  schemaVersion: 1
  state: KlondikeState
  initialDeal: KlondikeState
}

function revive(value: unknown): KlondikeState | null {
  if (!value || typeof value !== 'object') return null
  const state = value as KlondikeState
  const cards = [...state.stock ?? [], ...state.waste ?? [], ...(state.columns ?? []).flatMap(column => [...(column?.hidden ?? []), ...(column?.up ?? [])])]
  if (cards.length !== 52 || !Array.isArray(state.columns) || state.columns.length !== 7) return null
  if (new Set(cards.map(card => card?.id)).size !== 52) return null
  if (typeof state.foundations?.spades !== 'number') return null
  return state
}

function restoreSave(value: unknown): SaveEnvelope | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<SaveEnvelope>
  if (candidate.schemaVersion !== 1) return null
  const state = revive(candidate.state)
  const initialDeal = revive(candidate.initialDeal)
  return state && initialDeal ? { schemaVersion: 1, state, initialDeal } : null
}

export async function mountKlondike(container: HTMLElement, onExit: () => void): Promise<{ destroy: () => void }> {
  const saved = restoreSave(await loadGameSave<unknown>(SAVE_KEY))
  const initialDeal = saved?.initialDeal ?? newDeal()
  const initialState = saved?.state ?? initialDeal
  const audio = new GameAudio()
  let game: Phaser.Game | null = new Phaser.Game({
    callbacks: { postBoot: enableHighDpi },
    type: Phaser.AUTO, parent: container, width: 1024, height: 768, backgroundColor: '#23614f',
    scene: new KlondikeScene(audio, {
      onExit,
      onStateChange: (state, deal) => void saveGame(SAVE_KEY, { schemaVersion: 1, state, initialDeal: deal } satisfies SaveEnvelope)
    }, initialState, initialDeal),
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: true }
  })
  return { destroy: () => { game?.destroy(true); game = null; audio.dispose() } }
}
