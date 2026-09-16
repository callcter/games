import { mountPuzzle } from '../puzzle-kit/mount'
import { TangramScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new TangramScene(audio, onExit))
