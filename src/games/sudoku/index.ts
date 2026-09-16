import { mountPuzzle } from '../puzzle-kit/mount'
import { SudokuScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new SudokuScene(audio, onExit))
