import fs from 'node:fs'

let failed = false

const required = [
  'src/games/puzzle-kit/play-area.ts',
  'src/games/puzzle-kit/physical-metrics.ts',
  'src/games/puzzle-kit/scene.ts',
  'src/games/nonogram/layout.ts',
  'src/games/sudoku/layout.ts'
]

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`missing: ${file}`)
    failed = true
  }
}

const puzzle = fs.existsSync('src/games/puzzle-kit/scene.ts')
  ? fs.readFileSync('src/games/puzzle-kit/scene.ts', 'utf8')
  : ''

for (const token of [
  'measurePhysicalMetrics',
  'physicalMetrics()',
  'contentFont(',
  'touchTarget(',
  'logicalForCss(44)',
  'atLeastCss(60, 44)',
  'atLeastCss(21, 15)'
]) {
  if (!puzzle.includes(token)) {
    console.error(`PuzzleScene physical token missing: ${token}`)
    failed = true
  }
}

const responsiveGames = [
  'memory',
  'pipes',
  'sokoban',
  'nonogram',
  'maze',
  'sudoku',
  'tangram',
  'untangle'
]

for (const game of responsiveGames) {
  const file = `src/games/${game}/scene.ts`
  const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  if (!source.includes('useResponsivePlayArea = true')) {
    console.error(`v5 responsive opt-in missing: ${game}`)
    failed = true
  }
}

const sudokuLayout = fs.existsSync('src/games/sudoku/layout.ts')
  ? fs.readFileSync('src/games/sudoku/layout.ts', 'utf8')
  : ''
for (const token of ['digitColumns', 'digitRowGap', 'size === 9 ? 5']) {
  if (!sudokuLayout.includes(token)) {
    console.error(`Sudoku keypad layout missing: ${token}`)
    failed = true
  }
}

const sudokuScene = fs.existsSync('src/games/sudoku/scene.ts')
  ? fs.readFileSync('src/games/sudoku/scene.ts', 'utf8')
  : ''
for (const token of ['layout.digitColumns', 'layout.digitRowGap', 'contentFont(Math.max(13']) {
  if (!sudokuScene.includes(token)) {
    console.error(`Sudoku physical integration missing: ${token}`)
    failed = true
  }
}

const nonogramLayout = fs.existsSync('src/games/nonogram/layout.ts')
  ? fs.readFileSync('src/games/nonogram/layout.ts', 'utf8')
  : ''
if (!nonogramLayout.includes('footerY - 110')) {
  console.error('Nonogram phone control spacing is not 110 logical')
  failed = true
}

const untangle = fs.existsSync('src/games/untangle/scene.ts')
  ? fs.readFileSync('src/games/untangle/scene.ts', 'utf8')
  : ''
if (!untangle.includes('touchTarget(74, 44)')) {
  console.error('Untangle node physical hit target missing')
  failed = true
}

const screenshotDirs = [
  'screenshots/phone-390x844',
  'screenshots/ipad-768x1024',
  'screenshots/ipad-1024x768'
]
if (screenshotDirs.every(dir => fs.existsSync(dir))) {
  const total = screenshotDirs.reduce(
    (sum, dir) => sum + fs.readdirSync(dir).filter(name => name.endsWith('.png')).length,
    0
  )
  if (total !== 75) {
    console.error(`gallery expected 75 pngs, got ${total}`)
    failed = true
  }
}

if (!failed) console.log('verify-v5c: OK')
process.exit(failed ? 1 : 0)
