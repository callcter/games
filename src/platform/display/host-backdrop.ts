// FIT 画布留白的屏幕级延伸。
// - setHostBackdrop：画布外只延伸主题色，避免同图两种缩放造成重复物件与硬接缝
//   （whack-mole / red-rain / pop-bubbles 在用，保持原行为）；
// - setHostBackdropImage：整屏铺同一张背景图（CSS cover），画布内外同图 cover 取景，
//   纹理类背景（木纹/壁纸）视觉连续，适合 v3 背景批次。
// 离开游戏时由场景的 SHUTDOWN/DESTROY 幂等释放。
let holder: HTMLElement | null = null

function acquire(host: HTMLElement): HTMLElement {
  releaseHostBackdrop()
  holder = host
  return host
}

export function setHostBackdrop(url: string): void {
  const host = document.querySelector<HTMLElement>('.game-host')
  if (!host) return
  // 画布外只延伸主题色，避免同图不同缩放造成重复物件与硬接缝。
  const tone = url.includes('red-rain') ? '#34253f'
    : url.includes('pop-bubbles') ? '#caebf5'
    : url.includes('whack') ? '#dceac6' : '#eee3cf'
  acquire(host).style.backgroundImage = `linear-gradient(${tone}, ${tone})`
}

export function setHostBackdropImage(url: string): void {
  const host = document.querySelector<HTMLElement>('.game-host')
  if (!host) return
  host.style.backgroundImage = `url(${url})`
  host.style.backgroundSize = 'cover'
  host.style.backgroundPosition = 'center'
  host.style.backgroundRepeat = 'no-repeat'
}

export function releaseHostBackdrop(): void {
  if (!holder) return
  holder.style.backgroundImage = ''
  holder.style.backgroundSize = ''
  holder.style.backgroundPosition = ''
  holder.style.backgroundRepeat = ''
  holder = null
}
