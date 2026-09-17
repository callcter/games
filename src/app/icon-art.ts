// 大厅图标精灵图：加载 → 边缘连通白底转透明 → 逐帧按内容裁剪居中，
// 替换对应游戏的 SVG 兜底图标。素材缺失或加载失败时静默保留 SVG。

interface LobbySheet {
  url: string
  cols: number
  rows: number
  // 按行序排列的游戏 id（先行后列），与生成提示词一一对应。
  ids: string[]
}

export const LOBBY_SHEETS: readonly LobbySheet[] = [
  { url: 'art/lobby-a.png', cols: 3, rows: 2, ids: ['2048', 'tetris', 'gomoku', 'minesweeper', 'spider', 'freecell'] }
]

const FRAME_OUTPUT = 128

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

// 从四角洪水填充清掉与边缘连通的近白像素；格子间隙与图标内部的高光互不连通，得以保留。
function stripEdgeWhite(data: Uint8ClampedArray, width: number, height: number): void {
  const nearWhite = (i: number): boolean =>
    data[i]! >= 240 && data[i + 1]! >= 240 && data[i + 2]! >= 240
  const stack: number[] = []
  const push = (x: number, y: number): void => {
    stack.push(y * width + x)
  }
  push(0, 0); push(width - 1, 0); push(0, height - 1); push(width - 1, height - 1)
  while (stack.length) {
    const index = stack.pop()!
    if (data[index * 4 + 3]! === 0 || !nearWhite(index * 4)) continue
    data[index * 4 + 3] = 0
    const x = index % width, y = (index - x) / width
    if (x > 0) push(x - 1, y)
    if (x < width - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < height - 1) push(x, y + 1)
  }
}

function extractFrames(image: HTMLImageElement, sheet: LobbySheet): (string | null)[] {
  const source = document.createElement('canvas')
  source.width = image.naturalWidth
  source.height = image.naturalHeight
  const ctx = source.getContext('2d', { willReadFrequently: true })
  if (!ctx) return sheet.ids.map(() => null)
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, source.width, source.height)
  stripEdgeWhite(pixels.data, source.width, source.height)
  ctx.putImageData(pixels, 0, 0)
  const cellW = Math.floor(source.width / sheet.cols), cellH = Math.floor(source.height / sheet.rows)
  return sheet.ids.map((_, index) => {
    const col = index % sheet.cols, row = Math.floor(index / sheet.cols)
    let left = -1, top = -1, right = -1, bottom = -1
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        if (pixels.data[((row * cellH + y) * source.width + col * cellW + x) * 4 + 3]! <= 24) continue
        if (left < 0) { left = x; top = y }
        right = x; bottom = y
      }
    }
    if (left < 0) return null
    const size = Math.max(right - left + 1, bottom - top + 1)
    const frame = document.createElement('canvas')
    frame.width = FRAME_OUTPUT; frame.height = FRAME_OUTPUT
    frame.getContext('2d')!.drawImage(
      source,
      col * cellW + left - (size - (right - left + 1)) / 2,
      row * cellH + top - (size - (bottom - top + 1)) / 2,
      size, size, 0, 0, FRAME_OUTPUT, FRAME_OUTPUT
    )
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
