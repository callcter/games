import Phaser from 'phaser'
import { GAME_UI, GAME_UI_FONT } from '../tokens'

export interface SegmentItem<T extends string | number> {
  value: T
  label: string
}

export interface SegmentControl<T extends string | number> {
  container: Phaser.GameObjects.Container
  setValue(value: T): void
  setPosition(x: number, y: number): void
}

export interface SegmentControlOptions<T extends string | number> {
  items: readonly SegmentItem<T>[]
  value: T
  width?: number
  height?: number
  onChange: (value: T) => void
}

/**
 * 适合“和电脑 / 双人”“基础 / 进阶 / 挑战”等短选项。
 * 不是网页 tab：保留 Cozy 的厚度、奶油色和蜂蜜边。
 */
export function createSegmentControl<T extends string | number>(
  scene: Phaser.Scene,
  options: SegmentControlOptions<T>
): SegmentControl<T> {
  const width = options.width ?? 320
  const height = options.height ?? 48
  const count = Math.max(1, options.items.length)
  const segmentWidth = width / count

  const container = scene.add.container(0, 0)
  const background = scene.add.graphics()
  const selected = scene.add.graphics()
  const labels = options.items.map((item, index) => {
    const text = scene.add.text(
      -width / 2 + segmentWidth * (index + 0.5),
      -1,
      item.label,
      {
        fontFamily: GAME_UI_FONT,
        fontSize: '16px',
        color: '#244c43',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5)
    return text
  })

  container.add([background, selected, ...labels])
  let current = options.value

  const paint = (): void => {
    background.clear()
    background.fillStyle(GAME_UI.colors.cocoa, 0.16)
    background.fillRoundedRect(-width/2, -height/2 + 5, width, height, height/2)
    background.fillStyle(GAME_UI.colors.creamLight, 0.98)
    background.fillRoundedRect(-width/2, -height/2, width, height - 5, height/2)
    background.lineStyle(2, GAME_UI.colors.honey, 0.55)
    background.strokeRoundedRect(-width/2 + 1, -height/2 + 1, width - 2, height - 7, height/2 - 1)

    const index = Math.max(0, options.items.findIndex(item => item.value === current))
    selected.clear()
    selected.fillStyle(GAME_UI.colors.forest, 1)
    selected.fillRoundedRect(
      -width/2 + index * segmentWidth + 4,
      -height/2 + 4,
      segmentWidth - 8,
      height - 13,
      (height - 13)/2
    )

    labels.forEach((label, i) => {
      label.setColor(i === index ? '#fffdf6' : '#244c43')
    })
  }

  options.items.forEach((item, index) => {
    const hit = scene.add.rectangle(
      -width / 2 + segmentWidth * (index + 0.5),
      -2,
      segmentWidth,
      height,
      0xffffff,
      0.001
    )
    hit.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (current === item.value) return
      current = item.value
      paint()
      options.onChange(item.value)
    })
    container.add(hit)
  })

  paint()

  return {
    container,
    setValue(value: T) {
      current = value
      paint()
    },
    setPosition(x: number, y: number) {
      container.setPosition(x, y)
    }
  }
}
