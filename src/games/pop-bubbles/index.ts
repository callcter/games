import { mountAction } from '../action-kit/mount'
import { PopBubblesScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountAction(container, exit, (audio, onExit) => new PopBubblesScene(audio, onExit))
