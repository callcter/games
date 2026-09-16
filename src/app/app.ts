import { puzzles } from './puzzles'
import { gameIcon } from './icons'
import { loadProgress, summarizeProgress } from '../games/puzzle-kit/progress'
import { CATEGORIES, categoryOf, clearOrder, orderedIds, readRecent, rememberRecent, writeOrder, type Category } from './library'

const games = [
  { id: '2048', title: '2048', symbol: '2ⁿ', ready: true },
  { id: 'gomoku', title: '五子棋', symbol: '●○', ready: true },
  { id: 'tetris', title: '俄罗斯方块', symbol: '▦', ready: true },
  { id: 'merge-fruit', title: '合成水果', symbol: '🍉', ready: true },
  { id: 'freecell', title: '空当接龙', symbol: '♠♥', ready: true },
  { id: 'spider', title: '蜘蛛纸牌', symbol: '🕷♠', ready: true },
  { id: 'minesweeper', title: '扫雷', symbol: '✹⚑', ready: true },
  ...puzzles
] as const

type PreferredOrientation = 'any' | 'portrait' | 'landscape'
type GameId = typeof games[number]['id']
type AppHistoryState =
  | { familyGameRoom: true; view: 'boundary' | 'home' }
  | { familyGameRoom: true; view: 'game'; game: GameId }
type UpdateCheckResult = 'available' | 'current' | 'offline' | 'unsupported' | 'error'

const HOME_URL = '#/'

function gameFromHash(hash: string): GameId | null {
  const id = hash.replace(/^#\//, '')
  return games.some((game) => game.id === id) ? id as GameId : null
}

function isAppHistoryState(value: unknown): value is AppHistoryState {
  return Boolean(value && typeof value === 'object' && (value as Partial<AppHistoryState>).familyGameRoom === true)
}

function gameScreenMarkup(loadingText: string, preferredOrientation: PreferredOrientation = 'any'): string {
  const hint = preferredOrientation === 'landscape'
    ? '横过来，牌会更大'
    : preferredOrientation === 'portrait'
      ? '竖过来，棋盘会更大'
      : ''
  return `
    <main class="game-screen" data-preferred-orientation="${preferredOrientation}">
      <p class="game-loading">${loadingText}</p>
      <div class="game-host"></div>
      ${hint ? `<p class="orientation-hint" role="status">↻ ${hint}</p>` : ''}
    </main>
  `
}

export function renderApp(root: HTMLDivElement | null): void {
  if (!root) throw new Error('找不到应用挂载节点')

  let activeGame: { destroy: () => void } | null = null
  let navigationId = 0
  let currentView: 'home' | 'game' = 'home'
  let pendingUpdate: (() => Promise<void>) | null = null
  let showUpdatedConfirmation = window.sessionStorage.getItem('family-game-room-updated') === '1'
  let exitInProgress = false
  let selectedCategory: Category = 'all'
  let editingOrder = false

  window.sessionStorage.removeItem('family-game-room-updated')

  const requestedGame = gameFromHash(window.location.hash)
  if (!isAppHistoryState(window.history.state)) {
    window.history.replaceState(
      { familyGameRoom: true, view: 'boundary' } satisfies AppHistoryState,
      '',
      HOME_URL
    )
    window.history.pushState(
      { familyGameRoom: true, view: 'home' } satisfies AppHistoryState,
      '',
      HOME_URL
    )
    if (requestedGame) {
      window.history.pushState(
        { familyGameRoom: true, view: 'game', game: requestedGame } satisfies AppHistoryState,
        '',
        `#/${requestedGame}`
      )
    }
  }

  const openGame = (game: GameId): void => {
    window.history.pushState(
      { familyGameRoom: true, view: 'game', game } satisfies AppHistoryState,
      '',
      `#/${game}`
    )
    route()
  }

  const goHome = (): void => {
    const state = window.history.state
    if (isAppHistoryState(state) && state.view === 'game') {
      window.history.back()
      return
    }
    window.history.replaceState(
      { familyGameRoom: true, view: 'home' } satisfies AppHistoryState,
      '',
      HOME_URL
    )
    route()
  }

  const showUpdatePrompt = (): void => {
    if (!pendingUpdate || currentView !== 'home') return
    const toast = root.querySelector<HTMLElement>('.update-toast')
    const button = toast?.querySelector<HTMLButtonElement>('button')
    if (!toast || !button) return
    toast.hidden = false
    button.onclick = async () => {
      button.disabled = true
      button.textContent = '正在更新…'
      window.sessionStorage.setItem('family-game-room-updated', '1')
      try {
        await pendingUpdate?.()
      } catch {
        window.sessionStorage.removeItem('family-game-room-updated')
        button.disabled = false
        button.textContent = '重试'
      }
    }
  }

  const showHome = (): void => {
    navigationId += 1
    const homeNavigation = navigationId
    activeGame?.destroy()
    activeGame = null
    currentView = 'home'
    const gameIds = games.map(game => game.id)
    const ordered = orderedIds(gameIds, gameIds).flatMap(id => games.find(game => game.id === id) ?? [])
    const recent = readRecent(gameIds).flatMap(id => games.find(game => game.id === id) ?? [])

    root.innerHTML = `
    <main class="app-shell">
      <header class="hero">
        <span class="hero__eyebrow">没有广告 · 随时离线</span>
        <h1>小树游戏屋</h1>
        <p>选一个小游戏，开心玩一会儿吧。</p>
        <div class="app-actions">
          ${editingOrder ? '' : '<button class="check-update" type="button">检查更新</button>'}
          <button class="edit-order" type="button">${editingOrder ? '' : '整理图标'}</button>
          <span class="update-status" role="status"></span>
        </div>
      </header>
      ${editingOrder ? `
      <div class="order-editor" role="status">
        <span>按住图标拖到喜欢的位置</span>
        <button type="button" data-order-reset>恢复默认</button>
        <button type="button" data-order-done>完成</button>
      </div>` : `
      ${recent.length ? `<section class="recent-games" aria-label="最近玩过"><h2>最近玩过</h2><div>${recent.map(game => `<button type="button" data-game="${game.id}">${gameIcon(game.id)} ${game.title}</button>`).join('')}</div></section>` : ''}
      <nav class="game-categories" aria-label="游戏分类">${CATEGORIES.map(category => `<button type="button" data-category="${category.id}" aria-pressed="${selectedCategory === category.id}">${category.title}</button>`).join('')}</nav>`}
      <section class="game-grid${editingOrder ? ' game-grid--editable' : ''}" aria-label="游戏列表">
        ${ordered.map((game) => `
          <button class="game-card${editingOrder ? ' game-card--editing' : ''}" data-game="${game.id}" ${editingOrder || selectedCategory === 'all' || categoryOf(game.id) === selectedCategory ? '' : 'hidden'} ${game.ready ? '' : 'disabled'}>
            <span class="game-card__symbol" aria-hidden="true">${gameIcon(game.id)}</span>
            <span class="game-card__title">${game.title}</span>
            <span class="game-card__status">${game.ready ? '' : '正在准备'}</span>
          </button>
        `).join('')}
      </section>
    </main>
    <aside class="update-toast" role="status" hidden>
      <span>游戏屋有新版本啦</span>
      <button type="button">立即更新</button>
    </aside>
    <aside class="updated-toast" role="status" hidden>已更新到最新版，可以继续玩啦</aside>
    <section class="exit-confirm" role="dialog" aria-modal="true" aria-labelledby="exit-title" hidden>
      <div class="exit-confirm__panel">
        <h2 id="exit-title">要退出游戏屋吗？</h2>
        <p>在 iPad 主屏幕应用中，确认后请从屏幕底部上滑关闭。</p>
        <div>
          <button type="button" data-exit-cancel>继续玩</button>
          <button type="button" data-exit-confirm>退出</button>
        </div>
      </div>
    </section>
    <aside class="exit-help" role="status" hidden>请从屏幕底部上滑，关闭游戏屋。</aside>
    `

    root.querySelectorAll<HTMLButtonElement>('[data-game]').forEach(button => button.addEventListener('click', () => {
      if (editingOrder) return
      const game = games.find(game => game.id === button.dataset.game)
      if (game) openGame(game.id)
    }))
    root.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button => button.addEventListener('click', () => {
      selectedCategory = button.dataset.category as Category
      root.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button)))
      root.querySelectorAll<HTMLButtonElement>('.game-card').forEach(card => { card.hidden = selectedCategory !== 'all' && categoryOf(card.dataset.game!) !== selectedCategory })
    }))

    // 图标排序：进入编辑、拖动重排（FLIP 过渡）、完成或恢复默认。
    root.querySelector<HTMLButtonElement>('.edit-order')?.addEventListener('click', () => {
      editingOrder = true
      showHome()
    })
    root.querySelector<HTMLButtonElement>('[data-order-done]')?.addEventListener('click', () => {
      editingOrder = false
      showHome()
    })
    root.querySelector<HTMLButtonElement>('[data-order-reset]')?.addEventListener('click', () => {
      clearOrder()
      editingOrder = false
      showHome()
    })
    if (editingOrder) setupOrderDragging()

    // 各益智游戏的最好成绩加载完成后填进卡片副标题；导航离开后丢弃过期结果。
    void loadProgress().then(progress => {
      if (currentView !== 'home' || homeNavigation !== navigationId) return
      for (const [id, line] of Object.entries(summarizeProgress(progress))) {
        const status = root.querySelector<HTMLElement>(`[data-game="${id}"] .game-card__status`)
        if (status) status.textContent = line
      }
    })

    root.querySelector<HTMLButtonElement>('.check-update')?.addEventListener('click', () => {
      const status = root.querySelector<HTMLElement>('.update-status')
      if (status) status.textContent = '正在检查…'
      window.dispatchEvent(new CustomEvent('app-check-for-update', {
        detail: (result: UpdateCheckResult) => {
          if (!status) return
          const messages: Record<UpdateCheckResult, string> = {
            available: '发现新版本',
            current: '已经是最新版',
            offline: '离线时无法检查',
            unsupported: '当前环境不支持',
            error: '检查失败，请稍后再试'
          }
          status.textContent = messages[result]
        }
      }))
    })

    root.querySelector<HTMLButtonElement>('[data-exit-cancel]')?.addEventListener('click', () => {
      window.history.pushState(
        { familyGameRoom: true, view: 'home' } satisfies AppHistoryState,
        '',
        HOME_URL
      )
      const dialog = root.querySelector<HTMLElement>('.exit-confirm')
      if (dialog) dialog.hidden = true
    })

    root.querySelector<HTMLButtonElement>('[data-exit-confirm]')?.addEventListener('click', () => {
      exitInProgress = true
      window.close()
      window.history.back()
      window.setTimeout(() => {
        if (document.visibilityState !== 'visible') return
        exitInProgress = false
        window.history.pushState(
          { familyGameRoom: true, view: 'home' } satisfies AppHistoryState,
          '',
          HOME_URL
        )
        const dialog = root.querySelector<HTMLElement>('.exit-confirm')
        const help = root.querySelector<HTMLElement>('.exit-help')
        if (dialog) dialog.hidden = true
        if (help) help.hidden = false
      }, 400)
    })

    showUpdatePrompt()
    if (showUpdatedConfirmation) {
      showUpdatedConfirmation = false
      const toast = root.querySelector<HTMLElement>('.updated-toast')
      if (toast) {
        toast.hidden = false
        window.setTimeout(() => { toast.hidden = true }, 3200)
      }
    }
  }

  /** 编辑模式下的拖拽排序：拖起克隆、目标格实时让位（FLIP 过渡）、松手即保存顺序。 */
  const setupOrderDragging = (): void => {
    const grid = root.querySelector<HTMLElement>('.game-grid')
    if (!grid) return
    grid.addEventListener('pointerdown', (event: PointerEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('.game-card')
      if (!card || !grid.contains(card)) return
      event.preventDefault()
      const rect = card.getBoundingClientRect()
      const grabX = event.clientX - rect.left
      const grabY = event.clientY - rect.top
      const ghost = card.cloneNode(true) as HTMLElement
      ghost.classList.add('game-card--ghost')
      ghost.style.width = `${rect.width}px`
      ghost.style.height = `${rect.height}px`
      ghost.style.left = `${rect.left}px`
      ghost.style.top = `${rect.top}px`
      document.body.appendChild(ghost)
      card.classList.add('game-card--lifted')
      grid.classList.add('dragging')
      let lastTarget: Element | null = null

      const flip = (mutate: () => void): void => {
        const cards = [...grid.querySelectorAll<HTMLElement>('.game-card')]
        const before = new Map(cards.map(item => {
          const box = item.getBoundingClientRect()
          return [item, `${box.left} ${box.top}`]
        }))
        mutate()
        for (const item of cards) {
          const [oldLeft = 0, oldTop = 0] = (before.get(item) ?? '0 0').split(' ').map(Number)
          const box = item.getBoundingClientRect()
          const dx = oldLeft - box.left
          const dy = oldTop - box.top
          if (!dx && !dy) continue
          item.style.transition = 'none'
          item.style.transform = `translate(${dx}px, ${dy}px)`
          requestAnimationFrame(() => {
            item.style.transition = 'transform 220ms ease'
            item.style.transform = ''
          })
        }
      }

      // move/up 挂 window：指针事件的 target 可能是其他卡片（部分环境 pointer
      // capture 不可用），只有 window 能稳定收到整段拖拽。
      const onMove = (moveEvent: PointerEvent): void => {
        ghost.style.left = `${moveEvent.clientX - grabX}px`
        ghost.style.top = `${moveEvent.clientY - grabY}px`
        const center = { x: moveEvent.clientX, y: moveEvent.clientY }
        let target: HTMLElement | null = null
        for (const item of [...grid.querySelectorAll<HTMLElement>('.game-card')]) {
          if (item === card) continue
          const box = item.getBoundingClientRect()
          if (center.x >= box.left && center.x <= box.right && center.y >= box.top && center.y <= box.bottom) { target = item; break }
        }
        if (!target || target === lastTarget) return
        lastTarget = target
        const box = target.getBoundingClientRect()
        const beforeHalf = center.x < box.left + box.width / 2
        flip(() => { grid.insertBefore(card, beforeHalf ? target : target!.nextSibling) })
      }

      const onDrop = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onDrop)
        window.removeEventListener('pointercancel', onDrop)
        ghost.remove()
        card.classList.remove('game-card--lifted')
        grid.classList.remove('dragging')
        writeOrder([...grid.querySelectorAll<HTMLElement>('.game-card')].map(item => item.dataset.game ?? '').filter(Boolean))
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onDrop)
      window.addEventListener('pointercancel', onDrop)
    })
  }

  const show2048 = async (): Promise<void> => {
    currentView = 'game'
    const currentNavigation = ++navigationId
    activeGame?.destroy()
    activeGame = null
    root.innerHTML = gameScreenMarkup('正在摆好棋盘…')
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const { mount2048 } = await import('../games/game-2048')
    if (currentNavigation !== navigationId) return
    const mountedGame = await mount2048(host, () => {
      goHome()
    })
    if (currentNavigation !== navigationId) {
      mountedGame.destroy()
      return
    }
    activeGame = mountedGame
    root.querySelector('.game-loading')?.remove()
  }

  const showGomoku = async (): Promise<void> => {
    currentView = 'game'
    const currentNavigation = ++navigationId
    activeGame?.destroy()
    activeGame = null
    root.innerHTML = gameScreenMarkup('正在摆好棋盘…')
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const { mountGomoku } = await import('../games/gomoku')
    if (currentNavigation !== navigationId) return
    const mountedGame = await mountGomoku(host, () => {
      goHome()
    })
    if (currentNavigation !== navigationId) {
      mountedGame.destroy()
      return
    }
    activeGame = mountedGame
    root.querySelector('.game-loading')?.remove()
  }

  const showTetris = async (): Promise<void> => {
    currentView = 'game'
    const currentNavigation = ++navigationId
    activeGame?.destroy()
    activeGame = null
    root.innerHTML = gameScreenMarkup('正在整理方块…')
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const { mountTetris } = await import('../games/tetris')
    if (currentNavigation !== navigationId) return
    const mountedGame = await mountTetris(host, () => {
      goHome()
    })
    if (currentNavigation !== navigationId) {
      mountedGame.destroy()
      return
    }
    activeGame = mountedGame
    root.querySelector('.game-loading')?.remove()
  }

  const showMergeFruit = async (): Promise<void> => {
    currentView = 'game'
    const currentNavigation = ++navigationId
    activeGame?.destroy()
    activeGame = null
    root.innerHTML = gameScreenMarkup('正在洗水果…', 'portrait')
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const { mountMergeFruit } = await import('../games/merge-fruit')
    if (currentNavigation !== navigationId) return
    const mountedGame = await mountMergeFruit(host, () => {
      goHome()
    })
    if (currentNavigation !== navigationId) {
      mountedGame.destroy()
      return
    }
    activeGame = mountedGame
    root.querySelector('.game-loading')?.remove()
  }

  const showFreeCell = async (): Promise<void> => {
    currentView = 'game'
    const currentNavigation = ++navigationId
    activeGame?.destroy(); activeGame = null
    root.innerHTML = gameScreenMarkup('正在洗牌…', 'landscape')
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const { mountFreeCell } = await import('../games/freecell')
    if (currentNavigation !== navigationId) return
    const mountedGame = await mountFreeCell(host, goHome)
    if (currentNavigation !== navigationId) {
      mountedGame.destroy()
      return
    }
    activeGame = mountedGame
    root.querySelector('.game-loading')?.remove()
  }

  const showSpider = async (): Promise<void> => {
    currentView = 'game'
    const currentNavigation = ++navigationId
    activeGame?.destroy(); activeGame = null
    root.innerHTML = gameScreenMarkup('蜘蛛正在发牌…', 'landscape')
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const { mountSpider } = await import('../games/spider')
    if (currentNavigation !== navigationId) return
    const mountedGame = await mountSpider(host, goHome)
    if (currentNavigation !== navigationId) {
      mountedGame.destroy()
      return
    }
    activeGame = mountedGame
    root.querySelector('.game-loading')?.remove()
  }

  const showMinesweeper = async (): Promise<void> => {
    currentView = 'game'
    const currentNavigation = ++navigationId
    activeGame?.destroy()
    activeGame = null
    root.innerHTML = gameScreenMarkup('正在埋好地雷…', 'portrait')
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const { mountMinesweeper } = await import('../games/minesweeper')
    if (currentNavigation !== navigationId) return
    const mountedGame = await mountMinesweeper(host, goHome)
    if (currentNavigation !== navigationId) {
      mountedGame.destroy()
      return
    }
    activeGame = mountedGame
    root.querySelector('.game-loading')?.remove()
  }

  const showPuzzle = async (puzzle: typeof puzzles[number]): Promise<void> => {
    currentView = 'game'
    const currentNavigation = ++navigationId
    activeGame?.destroy()
    activeGame = null
    root.innerHTML = gameScreenMarkup('正在准备小游戏…', 'portrait')
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const module = await puzzle.load()
    if (currentNavigation !== navigationId) return
    const mounted = module.mount(host, goHome)
    if (currentNavigation !== navigationId) { mounted.destroy(); return }
    activeGame = mounted
    root.querySelector('.game-loading')?.remove()
  }

  const route = (): void => {
    const id = gameFromHash(window.location.hash)
    if (id) rememberRecent(id, games.map(game => game.id))
    const puzzle = puzzles.find(item => `#/${item.id}` === window.location.hash)
    if (puzzle) { void showPuzzle(puzzle); return }
    if (window.location.hash === '#/2048') void show2048()
    else if (window.location.hash === '#/gomoku') void showGomoku()
    else if (window.location.hash === '#/tetris') void showTetris()
    else if (window.location.hash === '#/merge-fruit') void showMergeFruit()
    else if (window.location.hash === '#/freecell') void showFreeCell()
    else if (window.location.hash === '#/spider') void showSpider()
    else if (window.location.hash === '#/minesweeper') void showMinesweeper()
    else showHome()
  }

  window.addEventListener('app-update-available', ((event: CustomEvent<() => Promise<void>>) => {
    pendingUpdate = event.detail
    showUpdatePrompt()
  }) as EventListener)

  window.addEventListener('popstate', (event) => {
    const state = event.state as unknown
    if (isAppHistoryState(state) && state.view === 'boundary' && !exitInProgress) {
      const dialog = root.querySelector<HTMLElement>('.exit-confirm')
      if (dialog) dialog.hidden = false
      return
    }
    route()
  })
  route()
}
