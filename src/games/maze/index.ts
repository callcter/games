import { mountPuzzle } from '../puzzle-kit/mount'
import { MazeScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new MazeScene(audio, onExit))
