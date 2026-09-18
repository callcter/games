import Phaser from 'phaser'

// ?raw + data URI：Phaser 4 的 XHRLoader 对 Vite ?url 资源走 atob 解码路径会报
// InvalidCharacterError；改为原始 SVG 文本内联 data URI，构建仍只打包引用的图标。
import arrowLeftSvg from '@phosphor-icons/core/bold/arrow-left-bold.svg?raw'
import speakerHighSvg from '@phosphor-icons/core/bold/speaker-high-bold.svg?raw'
import speakerSlashSvg from '@phosphor-icons/core/bold/speaker-slash-bold.svg?raw'
import undoSvg from '@phosphor-icons/core/bold/arrow-counter-clockwise-bold.svg?raw'
import shuffleSvg from '@phosphor-icons/core/bold/shuffle-bold.svg?raw'
import restartSvg from '@phosphor-icons/core/bold/arrow-clockwise-bold.svg?raw'
import hintSvg from '@phosphor-icons/core/bold/lightbulb-bold.svg?raw'
import homeSvg from '@phosphor-icons/core/bold/house-bold.svg?raw'
import settingsSvg from '@phosphor-icons/core/bold/gear-six-bold.svg?raw'
import crownSvg from '@phosphor-icons/core/bold/crown-bold.svg?raw'
import caretRightSvg from '@phosphor-icons/core/bold/caret-right-bold.svg?raw'

// Phaser 4 的 XHRLoader 对 data: URI 一律走 base64 解码分支，
// 因此必须用 base64 形式（Phosphor SVG 均为 ASCII，btoa 安全）。
const asDataUri = (svg: string): string =>
  `data:image/svg+xml;base64,${btoa(svg)}`

/**
 * UI 语义名，不暴露 Phosphor 文件名给具体游戏。
 *
 * `new` 是旧 Water Sort 的兼容语义；视觉上与 restart 使用同一 glyph。
 */
export type GameUiIconName =
  | 'back'
  | 'sound'
  | 'muted'
  | 'undo'
  | 'shuffle'
  | 'restart'
  | 'new'
  | 'hint'
  | 'home'
  | 'settings'
  | 'difficulty'
  | 'next'

interface IconDefinition {
  key: string
  url: string
}

const dataUri = (svg: string): string => asDataUri(svg)

const ICONS: Readonly<Record<GameUiIconName, IconDefinition>> = {
  back: { key: 'game-ui-icon-back', url: dataUri(arrowLeftSvg) },
  sound: { key: 'game-ui-icon-sound', url: dataUri(speakerHighSvg) },
  muted: { key: 'game-ui-icon-muted', url: dataUri(speakerSlashSvg) },
  undo: { key: 'game-ui-icon-undo', url: dataUri(undoSvg) },
  shuffle: { key: 'game-ui-icon-shuffle', url: dataUri(shuffleSvg) },
  restart: { key: 'game-ui-icon-restart', url: dataUri(restartSvg) },
  new: { key: 'game-ui-icon-restart', url: dataUri(restartSvg) },
  hint: { key: 'game-ui-icon-hint', url: dataUri(hintSvg) },
  home: { key: 'game-ui-icon-home', url: dataUri(homeSvg) },
  settings: { key: 'game-ui-icon-settings', url: dataUri(settingsSvg) },
  difficulty: { key: 'game-ui-icon-difficulty', url: dataUri(crownSvg) },
  next: { key: 'game-ui-icon-next', url: dataUri(caretRightSvg) }
}

const UNIQUE_ICONS = Object.values(ICONS).filter(
  (entry, index, list) => list.findIndex(candidate => candidate.key === entry.key) === index
)

/**
 * 在 Scene preload() 中调用一次。
 * SVG 来自 @phosphor-icons/core@2.1.1，构建时由 Vite 打包，不访问 CDN。
 */
export function preloadGameUi(scene: Phaser.Scene): void {
  for (const icon of UNIQUE_ICONS) {
    if (!scene.textures.exists(icon.key)) {
      scene.load.svg(icon.key, icon.url)
    }
  }
}

export function gameUiIconTexture(icon: GameUiIconName): string {
  return ICONS[icon].key
}

export function createGameUiIcon(
  scene: Phaser.Scene,
  icon: GameUiIconName,
  size: number,
  tint: number
): Phaser.GameObjects.Image {
  return scene.add
    .image(0, 0, gameUiIconTexture(icon))
    .setDisplaySize(size, size)
    .setTint(tint)
}
