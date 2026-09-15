export interface GameViewport {
  width: number
  height: number
}

export function measureGameViewport(container: HTMLElement): GameViewport {
  const bounds = container.getBoundingClientRect()
  return {
    width: Math.max(1, Math.round(bounds.width || window.innerWidth)),
    height: Math.max(1, Math.round(bounds.height || window.innerHeight))
  }
}
