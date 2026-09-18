// 游戏背景图在画布外的延伸：FIT 画布在手机竖屏/宽屏上会留出大块 letterbox，
// 把同一张背景图以 cover 方式铺在 .game-host 上，画布外区域显示同图的裁切放大版，
// 视觉满屏且画布内部（768×900）严格不变形。离开游戏时由 destroy() 摘除。
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
