import { mountAction } from '../action-kit/mount'
import { RedRainScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountAction(container, exit, (audio, onExit) => new RedRainScene(audio, onExit))
