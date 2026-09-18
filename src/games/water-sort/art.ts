import Phaser from 'phaser'
import { preloadGameUi } from '../../ui'

export const WATER_BG_KEY = 'water-sort-bg'

export const WATER_SFX = {
  ui: 'water-sort-ui',
  lift: 'water-sort-lift',
  pour: 'water-sort-pour',
  invalid: 'water-sort-invalid',
  complete: 'water-sort-complete',
  victory: 'water-sort-victory'
} as const

export function preloadWaterSortArt(scene: Phaser.Scene): void {
  preloadGameUi(scene)

  if (!scene.textures.exists(WATER_BG_KEY)) {
    scene.load.image(WATER_BG_KEY, 'art/water-sort-bg.jpg')
  }

  scene.load.audio(WATER_SFX.ui, 'audio/water-sort/ui-tap.wav')
  scene.load.audio(WATER_SFX.lift, 'audio/water-sort/lift.wav')
  scene.load.audio(WATER_SFX.pour, 'audio/water-sort/pour.wav')
  scene.load.audio(WATER_SFX.invalid, 'audio/water-sort/invalid.wav')
  scene.load.audio(WATER_SFX.complete, 'audio/water-sort/complete.wav')
  scene.load.audio(WATER_SFX.victory, 'audio/water-sort/victory.wav')
}
