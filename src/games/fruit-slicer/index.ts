import { mountAction } from '../action-kit/mount'
import { FruitSlicerScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountAction(container, exit, (audio, onExit) => new FruitSlicerScene(audio, onExit))
