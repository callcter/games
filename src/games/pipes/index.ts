import { mountPuzzle } from '../puzzle-kit/mount'
import { PipesScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new PipesScene(audio, onExit))
