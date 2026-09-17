import { mountPuzzle } from '../puzzle-kit/mount'
import { WaterSortScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new WaterSortScene(audio, onExit))
