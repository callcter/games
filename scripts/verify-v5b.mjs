import fs from 'node:fs'
import crypto from 'node:crypto'

let failed = false

const required = [
  'src/games/maze/layout.ts',
  'src/games/sudoku/layout.ts',
  'src/games/tangram/layout.ts',
  'src/games/untangle/layout.ts',
  'tests/experience/responsive-puzzle-layout-v5b.test.ts'
]

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`missing v5-B file: ${file}`)
    failed = true
  }
}

const prerequisite = 'src/games/puzzle-kit/play-area.ts'
if (!fs.existsSync(prerequisite)) {
  console.error('v5-A prerequisite missing: src/games/puzzle-kit/play-area.ts')
  failed = true
} else {
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(prerequisite))
    .digest('hex')
  const expected = 'b3973b012d54939c1c089f76a07861b7d40eca53bb47f4055b2f5ce3c40c1636'
  if (hash !== expected) {
    console.warn(`play-area.ts SHA differs from authored v5-A: ${hash}`)
    console.warn('Continue only after reviewing the v5-A changes; do not blindly overwrite it.')
  }
}

const scenes = [
  'src/games/maze/scene.ts',
  'src/games/sudoku/scene.ts',
  'src/games/tangram/scene.ts',
  'src/games/untangle/scene.ts'
]

for (const file of scenes) {
  const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  if (!source.includes('useResponsivePlayArea = true')) {
    console.error(`responsive opt-in missing: ${file}`)
    failed = true
  }
  if (!source.includes('onPlayAreaResize')) {
    console.error(`resize layout hook missing: ${file}`)
    failed = true
  }
}

const tangram = fs.existsSync('src/games/tangram/scene.ts')
  ? fs.readFileSync('src/games/tangram/scene.ts', 'utf8')
  : ''
for (const token of ['tangramToDisplay', 'tangramToCore', 'dragOffset']) {
  if (!tangram.includes(token)) {
    console.error(`Tangram mapping token missing: ${token}`)
    failed = true
  }
}

const untangle = fs.existsSync('src/games/untangle/scene.ts')
  ? fs.readFileSync('src/games/untangle/scene.ts', 'utf8')
  : ''
for (const token of ['untangleToDisplay', 'untangleToCore', 'dragOffset']) {
  if (!untangle.includes(token)) {
    console.error(`Untangle mapping token missing: ${token}`)
    failed = true
  }
}

for (const core of [
  'src/games/maze/core/game.ts',
  'src/games/sudoku/core/game.ts',
  'src/games/tangram/core/game.ts',
  'src/games/untangle/core/game.ts'
]) {
  // verifier intentionally does not require core modifications.
  if (!fs.existsSync(core)) {
    console.error(`repo core unexpectedly missing: ${core}`)
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

if (!failed) console.log('verify-v5b: OK')
process.exit(failed ? 1 : 0)
