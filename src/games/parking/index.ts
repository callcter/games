import { mountPuzzle } from '../puzzle-kit/mount'
import { ParkingScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountPuzzle(container, exit, (audio, onExit) => new ParkingScene(audio, onExit))
