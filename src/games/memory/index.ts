import { mountPuzzle } from '../puzzle-kit/mount'
import { MemoryScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new MemoryScene(audio, onExit))
