import fs from 'node:fs'

let failed = false

const required = [
  'src/games/memory/card-view.ts',
  'src/games/memory/view-model.ts',
  'src/games/pipes/pipe-tile-view.ts',
  'src/games/pipes/view-model.ts',
  'src/games/sokoban/board-view.ts',
  'src/games/sokoban/view-model.ts',
  'src/games/memory/scene.ts',
  'src/games/pipes/scene.ts',
  'src/games/sokoban/scene.ts',
  'src/games/maze/scene.ts'
]

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`missing: ${file}`)
    failed = true
  }
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

const memory = read('src/games/memory/scene.ts')
const pipes = read('src/games/pipes/scene.ts')
const sokoban = read('src/games/sokoban/scene.ts')
const maze = read('src/games/maze/scene.ts')

for (const [name, source, maxReset] of [
  ['memory', memory, 1],
  ['pipes', pipes, 1],
  ['sokoban', sokoban, 2],
  ['maze', maze, 1]
]) {
  const count = (source.match(/resetView\(/g) ?? []).length
  if (count > maxReset) {
    console.error(`${name}: too many resetView calls (${count})`)
    failed = true
  }
}

for (const token of [
  'MemoryCardView',
  'memoryVisualDelta',
  'concealTimer'
]) {
  if (!memory.includes(token)) {
    console.error(`Memory continuity token missing: ${token}`)
    failed = true
  }
}

if (/handleFlip[\s\S]{0,1800}buildView\(/.test(memory)) {
  console.error('Memory handleFlip appears to rebuild the whole view')
  failed = true
}

for (const token of [
  'PipeTileView',
  'pipeQuarterTurnDelta',
  'animateCellTransition',
  'viewRevision'
]) {
  if (!pipes.includes(token)) {
    console.error(`Pipes continuity token missing: ${token}`)
    failed = true
  }
}

for (const token of [
  'SokobanBoardView',
  'this.board.animate',
  'viewRevision',
  'trimAndRemember'
]) {
  if (!sokoban.includes(token)) {
    console.error(`Sokoban continuity token missing: ${token}`)
    failed = true
  }
}

for (const token of [
  'hintMarker',
  'refreshVisuals',
  'killTweensOf(this.rabbit)'
]) {
  if (!maze.includes(token)) {
    console.error(`Maze continuity token missing: ${token}`)
    failed = true
  }
}

if (maze.includes('private draw():')) {
  console.error('Maze still exposes the old rebuild-everything draw() path')
  failed = true
}

const packageCorePatterns = [
  'src/games/memory/core',
  'src/games/pipes/core',
  'src/games/sokoban/core',
  'src/games/maze/core'
]
import { execFileSync } from 'node:child_process'
for (const dir of packageCorePatterns) {
  if (!fs.existsSync(dir)) {
    continue
  }
  // 仓库语义：core 目录本来就存在，护栏改为「本批不得改动 core」。
  const changed = execFileSync('git', ['status', '--porcelain', '--', dir], { encoding: 'utf8' })
  if (changed.trim()) {
    console.error(`v5-D must not modify core: ${dir}`)
    failed = true
  }
}

if (!failed) console.log('verify-v5d: OK')
process.exit(failed ? 1 : 0)
