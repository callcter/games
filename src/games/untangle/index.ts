import { mountPuzzle } from '../puzzle-kit/mount'
import { UntangleScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new UntangleScene(audio, onExit))
