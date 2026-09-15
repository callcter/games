// 目标设备是孩子的 iPad：只有当主要输入是鼠标/触控板这类精确指针时，
// 才值得展示键盘快捷键提示；触屏环境一律显示触控文案。
export function hasPrecisePointer(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}
