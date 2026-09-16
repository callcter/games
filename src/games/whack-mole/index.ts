import { mountAction } from '../action-kit/mount'
import { WhackMoleScene } from './scene'
export const mount = (container: HTMLElement, exit: () => void) => mountAction(container, exit, (audio, onExit) => new WhackMoleScene(audio, onExit))
