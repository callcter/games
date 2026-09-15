import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasPrecisePointer } from '../../src/platform/input/pointer-capability'

describe('pointer capability', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reports precise pointer on desktop-like environments', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({ matches: query === '(hover: hover) and (pointer: fine)' })
    })
    expect(hasPrecisePointer()).toBe(true)
  })

  it('reports touch-first on iPad-like coarse pointers', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false })
    })
    expect(hasPrecisePointer()).toBe(false)
  })

  it('falls back to touch-first when matchMedia is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(hasPrecisePointer()).toBe(false)
    vi.stubGlobal('window', undefined)
    expect(hasPrecisePointer()).toBe(false)
  })
})
