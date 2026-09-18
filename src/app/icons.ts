// 本地图标，不依赖系统 emoji 字体；细节在小尺寸和离线环境保持一致。
const circle = (x: number, y: number, r: number, fill: string) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
const rect = (x: number, y: number, w: number, h: number, fill: string, r = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`
const path = (d: string, fill = 'none') => `<path d="${d}" fill="${fill}"/>`
const label = (x: number, y: number, text: string, size = 18) => `<text x="${x}" y="${y}" text-anchor="middle" fill="#173f35" stroke="none" font-family="system-ui,sans-serif" font-weight="800" font-size="${size}">${text}</text>`
const green = '#58a897', coral = '#e88065', gold = '#e6b84d', blue = '#7e8dcd', cream = '#fffdf6'
const card = rect(17, 10, 32, 44, cream)
const watermelon = path('M9 27 A23 23 0 0 0 55 27Z', green) + path('M15 28 A17 17 0 0 0 49 28Z', coral) + path('M24 34l2 3m12-3-2 3m-4 4v3')
const bubbles = circle(23, 34, 13, '#a8dbeb') + circle(42, 23, 11, '#b9abde') + circle(44, 44, 9, '#f2cf79') + path('M17 30q0-4 4-4m17-6 3-2', 'none')
const flag = path('M17 52V14m1 0h27l-7 9 7 9H18', coral)
const mole = path('M14 45V32a18 18 0 0 1 36 0v13', '#bb896a') + circle(16, 22, 6, '#bb896a') + circle(48, 22, 6, '#bb896a') + circle(25, 31, 2, '#173f35') + circle(39, 31, 2, '#173f35') + circle(32, 38, 5, '#eea1a0') + path('M8 47q24 12 48 0', green)

// 未接入精灵图的四款（lobby-e/f 素材待生成）：画成与精灵图一致的圆角徽章风，
// 生成后被 installIconArt 自动替换。
const badge = (fill: string) => rect(3, 3, 58, 58, fill, 13)

const matchTiles = badge('#fdf3d9') + rect(12, 14, 30, 26, coral, 8) + rect(24, 26, 30, 26, gold, 8) + circle(27, 27, 5, cream) + circle(39, 39, 5, cream)

const klondikeCard = badge('#eaf1f7') + rect(13, 12, 30, 42, cream, 6) + rect(23, 18, 30, 42, cream, 6) + path('M40 30c-4 5-6 8-2 11q2 2 4-2 2 4 4 2c4-3 2-6-2-11', coral) + circle(46, 48, 2.5, coral)

const parkingCar = badge('#e4f2ea') + rect(10, 26, 44, 20, coral, 8) + rect(18, 18, 24, 12, '#a8dbeb', 5) + circle(19, 48, 4.5, '#36594b') + circle(45, 48, 4.5, '#36594b') + path('M12 16h8', green)

const testTube = badge('#e9f3f6') + path('M26 10h12v30a10 10 0 0 1-6 12 7 4 0 0 1-6-12Z', '#cfe8ef') + rect(26, 26, 12, 10, coral) + rect(26, 38, 12, 8, gold)

const art: Record<string, string> = {
  'water-sort': testTube,
  parking: parkingCar,
  klondike: klondikeCard,
  'tile-match': matchTiles,
  '2048': rect(8, 15, 30, 34, '#f2cf79') + rect(30, 23, 27, 31, coral) + label(23, 39, '4') + label(44, 46, '8'),
  gomoku: rect(8, 8, 48, 48, '#efd5a2') + path('M20 9v46M33 9v46M46 9v46M9 20h46M9 33h46M9 46h46') + circle(20, 20, 7, '#25493e') + circle(33, 33, 7, cream) + circle(46, 46, 7, '#25493e'),
  tetris: [[10,10,blue],[26,10,blue],[42,10,blue],[26,26,blue],[10,42,gold],[26,42,gold],[42,42,coral],[42,26,coral]].map(([x,y,c]) => rect(Number(x),Number(y),14,14,String(c),2)).join(''),
  'merge-fruit': watermelon + circle(21, 15, 7, coral) + path('M30 8v12m-4-4 4 4 4-4'),
  freecell: card + path('M32 20C22 29 19 35 25 38q4 2 7-3 3 5 7 3c6-3 3-9-7-18M32 35v9m-5 0h10', green),
  spider: card + path('M25 31l-9-6m9 12-9 4m23-10 9-6m-9 12 9 4') + circle(32, 34, 9, blue) + circle(29, 31, 1.5, cream) + circle(35, 31, 1.5, cream),
  minesweeper: flag + circle(46, 48, 7, blue) + path('M46 37v3m0 16v3m-11-11h3m16 0h3'),
  memory: rect(7, 10, 28, 39, blue) + rect(28, 16, 28, 39, cream) + path('M42 24l4 8 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1Z', gold),
  tangram: path('M8 31L32 7l24 24Z', coral) + path('M14 33h36v23Z', green) + path('M14 33v23h36Z', gold),
  pipes: path('M11 18h24v18h18v14H21V32H11Z', green) + path('M42 8q-12 13 0 13t0-13', '#80ccdf'),
  sokoban: rect(11, 11, 42, 42, '#d4a46a') + path('M17 17h30v30H17ZM18 18l28 28m0-28L18 46'),
  bubbles,
  'pop-bubbles': circle(29, 35, 18, '#a8dbeb') + path('M18 30q1-7 8-8M49 8v10m-5-5h10M50 32h7M36 7l-2 7'),
  'red-rain': rect(15, 11, 34, 45, '#e75d55') + path('M16 14l16 16 16-16', '#f29769') + circle(32, 35, 9, gold) + rect(30, 32, 4, 6, coral, 0) + circle(52, 12, 5, gold),
  'whack-mole': mole,
  'fruit-slicer': watermelon + path('M11 53L51 9m-34 43L55 14'),
  untangle: path('M12 15C51 4 57 48 24 49S9 20 37 26 53 61 13 54', '#efe1b9') + circle(12, 15, 5, coral) + circle(13, 54, 5, green),
  maze: path('M8 8h48v48H8V23h16v17h16V24h16M24 8v7h16') + circle(15, 48, 4, coral) + circle(49, 16, 4, green),
  nonogram: [[1,0],[3,0],[0,1],[1,1],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[2,3]].map(([x,y]) => rect(10+x!*9,15+y!*9,8,8,coral,1)).join(''),
  sudoku: rect(8,8,48,48,cream) + path('M24 9v46m16-46v46M9 24h46M9 40h46') + label(16,21,'1',12) + label(32,37,'2',12) + label(48,53,'3',12)
}

export const GAME_ICON_IDS = Object.keys(art)
export function gameIcon(id: string): string {
  // data-icon 供精灵图管线定位替换，id 只保留安全字符防止属性注入。
  const safeId = id.replace(/[^a-z0-9-]/gi, '')
  return `<svg class="game-icon" data-icon="${safeId}" viewBox="0 0 64 64" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g stroke="#36594b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art[id] ?? path('M20 32h24m-12-12v24')}</g></svg>`
}
