// 大厅图标精灵图：按网格整格裁剪，画到统一圆角徽章上替换 SVG 兜底图标。
// 不做透明化——生成图的纸牌等白色主体在描边不闭合时会被边缘洪水填充挖穿；
// 圆角徽章让白底图标自然融入卡片底色。素材缺失或加载失败时静默保留 SVG。

interface LobbySheet {
  url: string
  cols: number
  rows: number
  // 按行序排列的游戏 id（先行后列），与生成提示词一一对应。
  ids: string[]
}

export const LOBBY_SHEETS: readonly LobbySheet[] = [
  { url: 'art/lobby-a.png', cols: 3, rows: 2, ids: ['2048', 'tetris', 'gomoku', 'minesweeper', 'spider', 'freecell'] },
  { url: 'art/lobby-b.png', cols: 3, rows: 2, ids: ['merge-fruit', 'fruit-slicer', 'bubbles', 'pop-bubbles', 'red-rain', 'whack-mole'] },
  { url: 'art/lobby-c.png', cols: 3, rows: 2, ids: ['memory', 'tangram', 'pipes', 'sokoban', 'untangle', 'maze'] },
  { url: 'art/lobby-d.png', cols: 2, rows: 1, ids: ['sudoku', 'nonogram'] }
]

const BADGE = 128

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

function extractFrames(image: HTMLImageElement, sheet: LobbySheet): (string | null)[] {
  const cellW = image.naturalWidth / sheet.cols, cellH = image.naturalHeight / sheet.rows
  return sheet.ids.map((_, index) => {
    const col = index % sheet.cols, row = Math.floor(index / sheet.cols)
    const frame = document.createElement('canvas')
    frame.width = BADGE; frame.height = BADGE
    const ctx = frame.getContext('2d')!
    const radius = 22
    ctx.beginPath()
    ctx.moveTo(radius, 0)
    ctx.arcTo(BADGE, 0, BADGE, BADGE, radius)
    ctx.arcTo(BADGE, BADGE, 0, BADGE, radius)
    ctx.arcTo(0, BADGE, 0, 0, radius)
    ctx.arcTo(0, 0, BADGE, 0, radius)
    ctx.closePath()
    ctx.fillStyle = '#fffdf6'
    ctx.fill()
    // 格子内容留 9% 边距后整体缩进徽章，白底与徽章底色融合。
    const inset = Math.round(BADGE * 0.09)
    ctx.save()
    ctx.clip()
    ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH, inset, inset, BADGE - inset * 2, BADGE - inset * 2)
    ctx.restore()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#d8cdbb'
    ctx.stroke()
    return frame.toDataURL('image/png')
  })
}

/** 用精灵图图标替换 root 内对应游戏的 SVG 兜底图标；未覆盖的游戏保持原样。 */
export async function installIconArt(root: ParentNode): Promise<void> {
  for (const sheet of LOBBY_SHEETS) {
    const image = await loadImage(sheet.url)
    if (!image || !image.naturalWidth) continue
    extractFrames(image, sheet).forEach((dataUrl, index) => {
      const id = sheet.ids[index]
      if (!dataUrl || !id) return
      root.querySelectorAll<SVGElement>(`svg.game-icon[data-icon="${id}"]`).forEach(svg => {
        const img = document.createElement('img')
        img.className = 'game-icon'
        img.alt = ''
        img.draggable = false
        img.src = dataUrl
        svg.replaceWith(img)
      })
    })
  }
}
