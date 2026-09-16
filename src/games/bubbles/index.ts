import { mountPuzzle } from '../puzzle-kit/mount'
import { BubblesScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new BubblesScene(audio, onExit))
