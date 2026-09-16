import { mountPuzzle } from '../puzzle-kit/mount'
import { SokobanScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new SokobanScene(audio, onExit))
