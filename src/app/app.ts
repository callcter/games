const games = [
  { id: '2048', title: '2048', symbol: '2ⁿ', ready: true },
  { id: 'gomoku', title: '五子棋', symbol: '●○', ready: true },
  { id: 'tetris', title: '俄罗斯方块', symbol: '▦', ready: false },
  { id: 'merge-fruit', title: '合成水果', symbol: '🍉', ready: false }
] as const

export function renderApp(root: HTMLDivElement | null): void {
  if (!root) throw new Error('找不到应用挂载节点')

  let activeGame: { destroy: () => void } | null = null
  let navigationId = 0

  const showHome = (): void => {
    navigationId += 1
    activeGame?.destroy()
    activeGame = null

    root.innerHTML = `
    <main class="app-shell">
      <header class="hero">
        <span class="hero__eyebrow">没有广告 · 随时离线</span>
        <h1>小树游戏屋</h1>
        <p>选一个小游戏，开心玩一会儿吧。</p>
      </header>
      <section class="game-grid" aria-label="游戏列表">
        ${games.map((game) => `
          <button class="game-card" data-game="${game.id}" ${game.ready ? '' : 'disabled'}>
            <span class="game-card__symbol" aria-hidden="true">${game.symbol}</span>
            <span class="game-card__title">${game.title}</span>
            <span class="game-card__status">${game.ready ? '开始游戏' : '正在准备'}</span>
          </button>
        `).join('')}
      </section>
    </main>
    <aside class="update-toast" role="status" hidden>
      <span>游戏屋有新版本啦</span>
      <button type="button">退出游戏后更新</button>
    </aside>
    `

    root.querySelector<HTMLButtonElement>('[data-game="2048"]')?.addEventListener('click', () => {
      window.location.hash = '/2048'
    })
    root.querySelector<HTMLButtonElement>('[data-game="gomoku"]')?.addEventListener('click', () => {
      window.location.hash = '/gomoku'
    })
  }

  const show2048 = async (): Promise<void> => {
    const currentNavigation = ++navigationId
    activeGame?.destroy()
    activeGame = null
    root.innerHTML = '<main class="game-screen"><p class="game-loading">正在摆好棋盘…</p><div class="game-host"></div></main>'
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const { mount2048 } = await import('../games/game-2048')
    if (currentNavigation !== navigationId) return
    activeGame = await mount2048(host, () => {
      window.location.hash = '/'
    })
    root.querySelector('.game-loading')?.remove()
  }

  const showGomoku = async (): Promise<void> => {
    const currentNavigation = ++navigationId
    activeGame?.destroy()
    activeGame = null
    root.innerHTML = '<main class="game-screen"><p class="game-loading">正在摆好棋盘…</p><div class="game-host"></div></main>'
    const host = root.querySelector<HTMLDivElement>('.game-host')
    if (!host) return
    const { mountGomoku } = await import('../games/gomoku')
    if (currentNavigation !== navigationId) return
    activeGame = await mountGomoku(host, () => {
      window.location.hash = '/'
    })
    root.querySelector('.game-loading')?.remove()
  }

  const route = (): void => {
    if (window.location.hash === '#/2048') void show2048()
    else if (window.location.hash === '#/gomoku') void showGomoku()
    else showHome()
  }

  window.addEventListener('app-update-available', ((event: CustomEvent<() => Promise<void>>) => {
    const toast = root.querySelector<HTMLElement>('.update-toast')
    const button = toast?.querySelector<HTMLButtonElement>('button')
    if (!toast || !button) return
    toast.hidden = false
    button.addEventListener('click', () => void event.detail(), { once: true })
  }) as EventListener)

  window.addEventListener('hashchange', route)
  route()
}
