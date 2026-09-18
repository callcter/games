// FIT 画布留白延伸主题底色，避免同一背景按两种比例重复铺图。
// 离开游戏时由场景的 SHUTDOWN/DESTROY 幂等释放。
let holder: HTMLElement | null = null

export function setHostBackdrop(url: string): void {
  const host = document.querySelector<HTMLElement>('.game-host')
  if (!host) return
  releaseHostBackdrop()
  holder = host
  // 画布外只延伸主题色，避免同图不同缩放造成重复物件与硬接缝。
  const tone = url.includes('red-rain') ? '#34253f'
    : url.includes('pop-bubbles') ? '#caebf5'
    : url.includes('whack') ? '#dceac6' : '#eee3cf'
  host.style.backgroundImage = `linear-gradient(${tone}, ${tone})`

}

export function releaseHostBackdrop(): void {
  if (!holder) return
  holder.style.backgroundImage = ''
  holder.style.backgroundSize = ''
  holder.style.backgroundPosition = ''
  holder.style.backgroundRepeat = ''
  holder = null
}
