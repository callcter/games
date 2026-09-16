import { mountPuzzle } from '../puzzle-kit/mount'
import { NonogramScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new NonogramScene(audio, onExit))
