# 大厅图标生成指南（GPT-Image 2.5）

替换大厅手写 SVG 图标用的精灵图提示词。
依据 OpenAI 官方 Image Prompting Guide（GPT Image 2.5）整理。

## 模型与参数（与提示词正文分开设置）

| 参数 | 取值 | 本项目建议 |
| --- | --- | --- |
| model | `gpt-image-2.5-sunburst`（基础，质量高）/ `gpt-image-2.5-flare`（小模型，快） | 用 sunburst，图标质量优先 |
| size | `auto` 或自定义 `宽x高`（gpt-image-2 起支持任意分辨率：最长边 ≤3840、两边均为 16 的倍数；官方指南另有 1024×1024 / 1536×1024 / 1024×1536 等常用档） | 见下表 |
| quality | `auto` / `low` / `medium` / `high` / `xhigh` / `max` | `high`（含数字格） |
| background | `auto` / `opaque` / `transparent`（透明为 API 预览能力，输出 PNG） | `transparent`；若输出画了棋盘格伪影（假透明），退回 `opaque` 白底，接入端有洪水填充去白兜底 |

各精灵图尺寸（格子必须正方，方便逐帧切割）：

| 文件 | 网格 | size 参数 | 单格 |
| --- | --- | --- | --- |
| lobby-a.png | 3 列 × 2 行 | `1536x1024` | 512×512 |
| lobby-b.png | 3 列 × 2 行 | `1536x1024` | 512×512 |
| lobby-c.png | 3 列 × 2 行 | `1536x1024` | 512×512 |
| lobby-d.png | 2 列 × 1 行 | `1536x768` | 768×768 |

## 官方提示词要点（写法依据）

1. **分节结构**：复杂请求按 Task / Grid / Icons / Style / Constraints
   分节描述，不堆长句；
2. **图标导向**：官方 logo 范例要求 clean vector-like shapes、strong
   silhouette、simplicity over detail、小尺寸可读、平面无渐变；
3. **精确文字**：需要数字的格子把数字写进引号、说明位置与次数，
   其余格子明确「无文字」；
4. **负面清单**：明确排除 watermark、grid lines、drop shadows、
   extra text；
5. **一次只改一个变量**：四张图同会话连生成、Style 节一字不改，
   保持风格统一；某张不满意只重生成那张。

## 提示词（四张，覆盖 20 个游戏）

### lobby-a.png（2048 / 俄罗斯方块 / 五子棋 / 扫雷 / 蜘蛛纸牌 / 空当接龙）

```text
Task: icon sprite sheet for a children's game collection.
Grid: exactly 6 equal square cells, 3 columns by 2 rows, one icon per
cell, centered, each icon filling about 70% of its cell, same scale
in every cell.
Icons:
Row 1 — 1) two overlapping rounded game tiles: a coral tile showing
"4" and a gold tile showing "8"; 2) two colorful tetromino blocks,
one L-shape and one T-shape, mid-fall; 3) a wooden go-board corner
with one black and one white glossy round stone.
Row 2 — 4) a round cartoon landmine with a cute worried face and a
small red flag planted beside it; 5) a friendly little spider sitting
on a playing card; 6) a single playing card showing a large golden
spade ace.
Style: rounded flat vector icons for young children, thick smooth
outlines, soft limited pastel palette, simple bold silhouettes that
stay readable at 48 px.
Constraints: the digits "4" and "8" appear only on the two tiles in
cell 1; no other text anywhere; no watermark, no grid lines between
cells, no drop shadows, no gradients.
```

### lobby-b.png（合成水果 / 切水果 / 泡泡龙 / 点泡泡 / 红包雨 / 打地鼠）

```text
Task: icon sprite sheet for a children's game collection.
Grid: exactly 6 equal square cells, 3 columns by 2 rows, one icon per
cell, centered, each icon filling about 70% of its cell, same scale
in every cell.
Icons:
Row 1 — 1) a happy watermelon with a cute smiling face; 2) a
watermelon slice with a white slash line and a few juice droplets;
3) a cluster of three glossy bubbles in pink, blue and yellow.
Row 2 — 4) a golden bubble being popped with a small star burst;
5) a red Chinese money envelope with a golden seal and two gold
coins beside it; 6) a happy brown mole peeking out of a green hole.
Style: rounded flat vector icons for young children, thick smooth
outlines, soft limited pastel palette, simple bold silhouettes that
stay readable at 48 px.
Constraints: no text, no watermark, no grid lines between cells,
no drop shadows, no gradients.
```

### lobby-c.png（记忆翻牌 / 七巧板 / 接水管 / 推箱子 / 解绳结 / 迷宫）

```text
Task: icon sprite sheet for a children's game collection.
Grid: exactly 6 equal square cells, 3 columns by 2 rows, one icon per
cell, centered, each icon filling about 70% of its cell, same scale
in every cell.
Icons:
Row 1 — 1) two rounded playing-style cards, one face up showing a
golden star, one face down; 2) colorful tangram triangles forming a
little house; 3) two chunky mint-green pipe pieces, one elbow and
one straight.
Row 2 — 4) a small wooden crate with a smiling face on a tile floor;
5) a smooth tangled rope loop with one loose end lifted; 6) a
top-view simple maze path with a small flag at the exit.
Style: rounded flat vector icons for young children, thick smooth
outlines, soft limited pastel palette, simple bold silhouettes that
stay readable at 48 px.
Constraints: no text, no watermark, no grid lines between cells,
no drop shadows, no gradients.
```

### lobby-d.png（数独 / 数织）

```text
Task: icon sprite sheet for a children's game collection.
Grid: exactly 2 equal square cells side by side, 1 row by 2 columns,
one icon per cell, centered, each icon filling about 70% of its cell,
same scale in both cells.
Icons:
Left — a rounded 3 by 3 sudoku grid tile with the digits "1", "2"
and "3" on three soft tiles.
Right — a grid of dark and light rounded squares forming a heart
pixel pattern.
Style: rounded flat vector icons for young children, thick smooth
outlines, soft limited pastel palette, simple bold silhouettes that
stay readable at 48 px.
Constraints: the digits appear only inside the left sudoku icon; no
other text anywhere; no watermark, no grid lines between cells,
no drop shadows, no gradients.
```

## 交付与验收

1. 四张 PNG 命名 lobby-a/b/c/d.png 发我即可；
2. 我负责：检查 alpha 通道是否真透明（棋盘格伪影退回白底重生成）、
   逐帧切割校验网格对齐、放进 `public/art/`、替换 `icons.ts` 手写
   SVG、Workbox 离线预缓存与 iPad 高分屏验证；
3. 某张网格切歪或某格画错，只重生成那一张。

## 网格不齐时的补救（追加到原提示词末尾重生成）

```text
Important: keep all cells exactly the same size and perfectly
aligned to an invisible grid, with equal gaps between cells; do not
let any object cross a cell boundary.
```
