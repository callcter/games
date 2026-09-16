import { expect, it, vi } from 'vitest'
import source from '../../node_modules/phaser/src/core/VisibilityHandler.js?raw'

// 对实际安装的补丁做契约测试，升级/重装依赖时不能悄悄丢失清理逻辑。
class EventEmitter {
  private callbacks = new Map<string, Set<() => void>>()
  on(event: string, callback: () => void): void {
    const callbacks = this.callbacks.get(event) ?? new Set()
    callbacks.add(callback); this.callbacks.set(event, callbacks)
  }
  once(event: string, callback: () => void): void {
    const wrapped = (): void => { this.callbacks.get(event)?.delete(wrapped); callback() }
    this.on(event, wrapped)
  }
  emit(event: string): void { this.callbacks.get(event)?.forEach(callback => callback()) }
}
function fixture() {
  const listeners = new Set<EventListener>()
  const document = {
    hidden: false,
    addEventListener: (_name: string, fn: EventListener) => listeners.add(fn),
    removeEventListener: (_name: string, fn: EventListener) => listeners.delete(fn)
  }
  const window = { onblur: null as (() => void) | null, onfocus: null as (() => void) | null, focus: vi.fn() }
  const module = { exports: undefined as unknown }
  new Function('require', 'module', 'document', 'window', source)(() => ({ HIDDEN: 'hidden', VISIBLE: 'visible', BLUR: 'blur', FOCUS: 'focus', DESTROY: 'destroy' }), module, document, window)
  const install = module.exports as (game: { events: EventEmitter; config: { autoFocus: boolean } }) => void
  const game = () => ({ events: new EventEmitter(), config: { autoFocus: false } })
  return { listeners, document, window, install, game }
}
it('keeps visibility/focus behavior and releases handlers on destruction', () => {
  const f = fixture(), game = f.game(), hidden = vi.fn(), focus = vi.fn()
  game.events.on('hidden', hidden); game.events.on('focus', focus)
  f.install(game)
  f.document.hidden = true
  f.listeners.forEach(fn => fn({ type: 'visibilitychange' } as Event))
  f.window.onfocus?.()
  expect(hidden).toHaveBeenCalledOnce(); expect(focus).toHaveBeenCalledOnce()
  game.events.emit('destroy')
  expect(f.listeners.size).toBe(0)
  expect(f.window.onblur).toBeNull(); expect(f.window.onfocus).toBeNull()
})
it('does not remove a newer game’s window handlers', () => {
  const f = fixture(), old = f.game(), current = f.game()
  f.install(old); f.install(current)
  const focus = f.window.onfocus
  old.events.emit('destroy')
  expect(f.window.onfocus).toBe(focus)
  expect(f.listeners.size).toBe(1)
  current.events.emit('destroy')
  expect(f.listeners.size).toBe(0)
})
it('keeps listener count stable over repeated mounts', () => {
  const f = fixture()
  for (let i = 0; i < 30; i++) { const game = f.game(); f.install(game); game.events.emit('destroy') }
  expect(f.listeners.size).toBe(0)
})
