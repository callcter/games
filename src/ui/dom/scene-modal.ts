import Phaser from 'phaser'
import { GAME_UI } from '../tokens'
import './scene-modal.css'

export interface SceneModal {
  element: HTMLDialogElement
  close(): void
}

const openModals = new WeakMap<Phaser.Scene, SceneModal>()
// 关闭后的恢复要等 POST_STEP；在帧边界前关闭又立刻重开时，
// 暂停归属必须跨模态结算：记录打开计数与首次打开前的激活态。
const pauseState = new WeakMap<Phaser.Scene, { open: number; wasActive: boolean }>()

/** DOM 顶层模态与游戏生命周期的边界。所有权属于场景，不随棋盘重绘/相机变化。 */
export function showSceneModal(
  scene: Phaser.Scene,
  render: (dialog: HTMLDialogElement, close: () => void) => void,
  onClose?: () => void
): SceneModal {
  const current = openModals.get(scene)
  if (current) return current

  const state = pauseState.get(scene) ?? { open: 0, wasActive: scene.sys.isActive() }
  pauseState.set(scene, state)
  const wasActive = state.wasActive
  const element = document.createElement('dialog')
  element.className = 'game-scene-modal'
  element.style.setProperty('--game-ui-font', GAME_UI.font.family)
  for (const [name, value] of Object.entries(GAME_UI.colors)) {
    element.style.setProperty(`--game-ui-${name}`, `#${value.toString(16).padStart(6, '0')}`)
  }
  // 暂停整个场景：覆盖 update、Clock、tween、物理及 Phaser 输入；不修改游戏自己的暂停状态。
  const gameEvents = scene.game.events
  let closed = false

  const detach = (): void => {
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, dispose)
    scene.events.off(Phaser.Scenes.Events.DESTROY, dispose)
    gameEvents.off(Phaser.Core.Events.POST_STEP, restore)
    openModals.delete(scene)
  }
  const restore = (): void => {
    detach()
    // 只有没有新弹窗接手时才恢复；首开前场景本就暂停的不唤醒。
    if (state.open === 0) {
      if (wasActive && scene.sys.isPaused()) scene.sys.resume()
      pauseState.delete(scene)
    }
    onClose?.()
  }
  const removeElement = (): void => {
    element.removeEventListener('cancel', cancel)
    element.removeEventListener('close', close)
    element.close()
    element.remove()
  }
  const dispose = (): void => {
    if (!closed) {
      closed = true
      state.open = Math.max(0, state.open - 1)
      removeElement()
    }
    detach()
    if (state.open === 0) pauseState.delete(scene)
  }
  const close = (): void => {
    if (closed) return
    closed = true
    state.open = Math.max(0, state.open - 1)
    openModals.delete(scene)
    removeElement()
    // 关闭手势/键盘事件处理完、输入队列清空后才恢复，不能把同一事件交给棋盘。
    gameEvents.once(Phaser.Core.Events.POST_STEP, restore)
  }
  const cancel = (event: Event): void => { event.preventDefault(); close() }
  const modal = { element, close }
  render(element, close)
  element.addEventListener('cancel', cancel)
  element.addEventListener('close', close)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose)
  scene.events.once(Phaser.Scenes.Events.DESTROY, dispose)
  state.open += 1
  openModals.set(scene, modal)
  document.body.appendChild(element)
  if (wasActive && state.open === 1) scene.sys.pause()
  try { element.showModal() }
  catch (error) { dispose(); if (wasActive && scene.sys.isPaused()) scene.sys.resume(); throw error }
  return modal
}
