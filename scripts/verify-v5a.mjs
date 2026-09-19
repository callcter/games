import fs from 'node:fs'

let failed = false

const required = [
  'src/games/puzzle-kit/play-area.ts',
  'src/games/memory/layout.ts',
  'src/games/pipes/layout.ts',
  'src/games/sokoban/layout.ts',
  'src/games/nonogram/layout.ts',
  'tests/experience/responsive-puzzle-layout.test.ts'
]

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`missing: ${file}`)
    failed = true
  }
}

const scenes = [
  'src/games/memory/scene.ts',
  'src/games/pipes/scene.ts',
  'src/games/sokoban/scene.ts',
  'src/games/nonogram/scene.ts'
]

for (const file of scenes) {
  const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  if (!source.includes('useResponsivePlayArea = true')) {
    console.error(`responsive opt-in missing: ${file}`)
    failed = true
  }
  if (!source.includes('onPlayAreaResize')) {
    console.error(`resize relayout missing: ${file}`)
    failed = true
  }
}

const puzzleScene = fs.existsSync('src/games/puzzle-kit/scene.ts')
  ? fs.readFileSync('src/games/puzzle-kit/scene.ts', 'utf8')
  : ''

for (const token of ['useResponsivePlayArea', 'playArea(', 'onPlayAreaResize']) {
  if (!puzzleScene.includes(token)) {
    console.error(`PuzzleScene missing: ${token}`)
    failed = true
  }
}

const forbiddenCoreChanges = [
  'src/games/memory/core/game.ts',
  'src/games/pipes/core/game.ts',
  'src/games/sokoban/core/game.ts',
  'src/games/nonogram/core/game.ts'
]

for (const file of forbiddenCoreChanges) {
  // 这个脚本不解析 git diff；这里只防止交付包本身携带 core replacement。
  if (fs.existsSync(`v5a-package-core/${file}`)) {
    console.error(`unexpected core replacement: ${file}`)
    failed = true
  }
}

const dirs = [
  'screenshots/phone-390x844',
  'screenshots/ipad-768x1024',
  'screenshots/ipad-1024x768'
]
if (dirs.every(dir => fs.existsSync(dir))) {
  const total = dirs.reduce(
    (sum, dir) => sum + fs.readdirSync(dir).filter(name => name.endsWith('.png')).length,
    0
  )
  if (total !== 75) {
    console.error(`gallery expected 75 pngs, got ${total}`)
    failed = true
  }
}

if (!failed) console.log('verify-v5a: OK')
process.exit(failed ? 1 : 0)
