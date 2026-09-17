import { mountPuzzle } from '../puzzle-kit/mount'
import { TileMatchScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new TileMatchScene(audio, onExit))
