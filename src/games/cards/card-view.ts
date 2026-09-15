import Phaser from 'phaser'
import { rankLabel, suitSymbol, type Card } from './core/cards'

interface CardViewOptions {
  faceUp?: boolean
  selected?: boolean
  onSelect?: () => void
}

export function createCardView(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  card: Card,
  options: CardViewOptions = {}
): Phaser.GameObjects.Container {
  const faceUp = options.faceUp ?? true
  const container = scene.add.container(x, y)
  const graphics = new Phaser.GameObjects.Graphics(scene)
  graphics.fillStyle(faceUp ? 0xfffdf6 : 0x4770a7, 1)
  graphics.fillRoundedRect(0, 0, width, height, width * 0.09)
  graphics.lineStyle(options.selected ? 5 : 2, options.selected ? 0xf0bf4f : 0x173f35, options.selected ? 1 : 0.28)
  graphics.strokeRoundedRect(0, 0, width, height, width * 0.09)
  container.add(graphics)

  if (faceUp) {
    const color = card.color === 'red' ? '#c9443d' : '#173f35'
    const corner = new Phaser.GameObjects.Text(scene, width * 0.1, height * 0.06, `${rankLabel(card.rank)}${suitSymbol(card.suit)}`, {
      color, fontFamily: 'Georgia, Times New Roman, serif', fontSize: `${Math.max(15, width * 0.2)}px`, fontStyle: 'bold'
    })
    const suit = new Phaser.GameObjects.Text(scene, width / 2, height * 0.55, suitSymbol(card.suit), {
      color, fontFamily: 'Georgia, Times New Roman, serif', fontSize: `${Math.max(28, width * 0.48)}px`
    }).setOrigin(0.5)
    container.add([corner, suit])
  } else {
    const back = new Phaser.GameObjects.Text(scene, width / 2, height / 2, '◆', {
      color: '#d8e5f2', fontFamily: 'Georgia, serif', fontSize: `${width * 0.44}px`
    }).setOrigin(0.5)
    container.add(back)
  }

  container.setSize(width, height).setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains
  )
  if (options.onSelect) container.on('pointerup', options.onSelect)
  return container
}

export function createCardSlot(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onSelect: () => void
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y)
  const graphics = new Phaser.GameObjects.Graphics(scene)
  graphics.fillStyle(0xffffff, 0.08)
  graphics.fillRoundedRect(0, 0, width, height, width * 0.09)
  graphics.lineStyle(2, 0xffffff, 0.28)
  graphics.strokeRoundedRect(0, 0, width, height, width * 0.09)
  const text = new Phaser.GameObjects.Text(scene, width / 2, height / 2, label, {
    color: '#d7e7df', fontFamily: 'Avenir Next, PingFang SC, sans-serif', fontSize: `${Math.max(18, width * 0.3)}px`, fontStyle: 'bold'
  }).setOrigin(0.5)
  container.add([graphics, text])
  container.setSize(width, height).setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains
  ).on('pointerup', onSelect)
  return container
}

