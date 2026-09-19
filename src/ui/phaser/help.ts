// 保留所有场景既有的帮助入口；显示与模态生命周期由共享 DOM UI 层管理。
import type Phaser from 'phaser'
import { getGameHelp } from '../help-content'
import { showSceneModal } from '../dom/scene-modal'

const SEEN_KEY = 'family-game-room-help-seen-v1'

function seenIds(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function markHelpSeen(title: string): void {
  try {
    const ids = new Set(seenIds())
    ids.add(title)
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
  } catch {
    // 存储不可用时静默，下次再弹一次没有关系
  }
}

/** 帮助属于应用 UI，不放进会被场景重绘或相机缩放的 DisplayList。 */
export function showHelpPanel(scene: Phaser.Scene, title: string, onClose?: () => void): (() => void) | null {
  const help = getGameHelp(title)
  if (!help) return null
  const modal = showSceneModal(scene, (dialog, close) => {
    dialog.classList.add('game-help-dialog')
    dialog.setAttribute('aria-labelledby', 'game-help-title')
    const body = document.createElement('div')
    body.className = 'game-help-body'
    const icon = document.createElement('div')
    icon.className = 'game-help-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = help.icon
    const heading = document.createElement('h2')
    heading.id = 'game-help-title'
    heading.textContent = `${help.title} · 怎么玩`
    const goal = document.createElement('p')
    goal.className = 'game-help-goal'
    goal.textContent = help.goal
    const steps = document.createElement('ol')
    for (const step of help.steps) {
      const item = document.createElement('li')
      item.textContent = step
      steps.appendChild(item)
    }
    body.append(icon, heading, goal, steps)
    if (help.tip) {
      const tip = document.createElement('p')
      tip.className = 'game-help-tip'
      tip.textContent = `小提示：${help.tip}`
      body.appendChild(tip)
    }
    const footer = document.createElement('div')
    footer.className = 'game-help-footer'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'game-help-close'
    button.textContent = '知道啦，开始玩'
    button.addEventListener('click', close)
    footer.appendChild(button)
    dialog.append(body, footer)
  }, onClose)
  markHelpSeen(title)
  return modal.close
}

/** 首次进入自动说明与手动入口共用完全相同的暂停/恢复行为。 */
export function attachFirstRunHelp(scene: Phaser.Scene, title: string, delayMs = 700): void {
  if (!getGameHelp(title) || seenIds().includes(title)) return
  scene.time.delayedCall(delayMs, () => {
    if (!scene.scene || !scene.sys.isActive() || seenIds().includes(title)) return
    showHelpPanel(scene, title)
  })
}
