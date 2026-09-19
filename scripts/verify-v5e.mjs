import fs from 'node:fs'

let failed = false

const required = [
  'src/app/lobby-model.ts',
  'src/app/app.ts',
  'src/app/styles.css',
  'scripts/capture-gallery.mjs',
  'screenshots/README.md'
]

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`missing: ${file}`)
    failed = true
  }
}

const read = file =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''

const app = read('src/app/app.ts')
for (const token of [
  'LOBBY_CATEGORIES',
  'recentLobbyGames',
  'visibleLibraryIds',
  'libraryExpanded',
  'data-progress-for',
  'category-shelf',
  'library-toggle',
  'game-library'
]) {
  if (!app.includes(token)) {
    console.error(`app lobby token missing: ${token}`)
    failed = true
  }
}

if (!app.includes("selectedCategory = 'all'") || !app.includes('libraryExpanded = true')) {
  console.error('edit-order mode does not force the full all-games library')
  failed = true
}

const model = read('src/app/lobby-model.ts')
for (const token of [
  'slice(1, 4)',
  'previewLimit = 8',
  "category !== 'all' || expanded",
  'categoryOf(id)'
]) {
  if (!model.includes(token)) {
    console.error(`lobby model token missing: ${token}`)
    failed = true
  }
}

const styles = read('src/app/styles.css')
for (const selector of [
  '.resume-section',
  '.category-shelf',
  '.category-card',
  '.library-section',
  '.library-toggle',
  '.recent-strip'
]) {
  if (!styles.includes(selector)) {
    console.error(`lobby style missing: ${selector}`)
    failed = true
  }
}

const capture = read('scripts/capture-gallery.mjs')
if (!capture.includes('lobby: continue + categories + library preview')) {
  console.error('capture-gallery lobby state label is stale')
  failed = true
}
if (capture.includes("shot('home','lobby: 24 cards')")) {
  console.error('old lobby 24-card fixture label still present')
  failed = true
}

const screenshotDirs = [
  'screenshots/phone-390x844',
  'screenshots/ipad-768x1024',
  'screenshots/ipad-1024x768'
]
if (screenshotDirs.every(dir => fs.existsSync(dir))) {
  const total = screenshotDirs.reduce(
    (sum, dir) =>
      sum + fs.readdirSync(dir).filter(name => name.endsWith('.png')).length,
    0
  )
  if (total !== 75) {
    console.error(`gallery expected 75 pngs, got ${total}`)
    failed = true
  }
}

if (!failed) console.log('verify-v5e: OK')
process.exit(failed ? 1 : 0)
