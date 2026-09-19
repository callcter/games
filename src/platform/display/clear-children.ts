import type Phaser from 'phaser'

/**
 * 销毁场景级显示对象并清空渲染列表。
 *
 * Phaser 4 的 `scene.children` 是 DisplayList（继承 structs/List），
 * `removeAll(skipCallback)` 的参数是“跳过移除回调”——只把对象摘出列表，
 * 从不销毁它们；这与 `Container.removeAll(destroyChild)` 同名不同义。
 * 全量重绘型场景误用后，Text 的 canvas 纹理会随每步重绘永久累积，
 * 表现为“越玩越卡”（2048 每步移动泄漏的纹理数还随棋盘数字增多）。
 *
 * 本工具逐对象走 `destroy()`：触发 preDestroy 释放 Text 纹理/CanvasPool，
 * 并自动从 DisplayList 与 UpdateList 摘除。
 */
export function clearSceneChildren(scene: Phaser.Scene): void {
  for (const child of [...scene.children.list]) child.destroy()
}
