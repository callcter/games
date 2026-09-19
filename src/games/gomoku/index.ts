import Phaser from 'phaser'
import { enableHighDpi } from '../../platform/display/high-dpi'
import { GameAudio } from '../../platform/audio/game-audio'
import { measureGameViewport } from '../../platform/display/game-viewport'
import { GomokuScene } from './scene'

export interface MountedGame {
  destroy: () => void
}

export async function mountGomoku(container: HTMLElement, onExit: () => void): Promise<MountedGame> {
  const audio = new GameAudio()
  let game: Phaser.Game | null = null
  const scene = new GomokuScene(audio, { onExit })
  const viewport = measureGameViewport(container)

  game = new Phaser.Game({
    type: Phaser.AUTO,
    callbacks: { postBoot: enableHighDpi },
    parent: container,
    width: viewport.width,
    height: viewport.height,
    backgroundColor: '#f8f1df',
    scene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      antialias: true,
      roundPixels: true
    }
  })

  // 手机 15 路盘格子太小：DOM 缩放按钮（钉屏、不受 Phaser 相机缩放影响）。
  // 与场景内双指捏合等效，点 ＋ 放大后可拖动平移。
  const zoomBar = document.createElement('div')
  zoomBar.className = 'gomoku-zoom-bar'
  zoomBar.innerHTML = '<button type="button" data-zoom="1" aria-label="放大棋盘">＋</button>' +
    '<button type="button" data-zoom="-1" aria-label="缩小棋盘">－</button>'
  zoomBar.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      scene.stepZoom(button.dataset.zoom === '1' ? 1 : -1)
    })
  })
  container.appendChild(zoomBar)

  return {
    destroy: () => {
      zoomBar.remove()
      game?.destroy(true)
      game = null
      audio.dispose()
    }
  }
}
