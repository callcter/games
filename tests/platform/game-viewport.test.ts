import { afterEach, describe, expect, it, vi } from 'vitest'
import { measureGameViewport } from '../../src/platform/display/game-viewport'

describe('game viewport measurement', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the laid out host size and rounds it to canvas pixels', () => {
    const container = fakeContainer(767.6, 1023.7)
    expect(measureGameViewport(container)).toEqual({ width: 768, height: 1024 })
  })

  it('falls back to the browser viewport while the host is not laid out', () => {
    vi.stubGlobal('window', { innerWidth: 1024, innerHeight: 768 })
    expect(measureGameViewport(fakeContainer(0, 0))).toEqual({ width: 1024, height: 768 })
  })
})

function fakeContainer(width: number, height: number): HTMLElement {
  return {
    getBoundingClientRect: () => ({ width, height })
  } as HTMLElement
}
