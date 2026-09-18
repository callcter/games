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
| lobby-e.png | 3 列 × 1 行 | `1536x512` | 512×512 |
| lobby-f.png | 纸牌图标（单格） | 1×1 | `1024x1024` | 1024×1024 |

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

### lobby-e.png（水排序 / 停车场 / 叠叠消，新三款 3×1 收尾）

```text
Task: icon sprite sheet for a children's game collection.
Grid: exactly 3 equal square cells side by side, 1 row by 3 columns,
one icon per cell, centered, each icon filling about 70% of its cell,
same scale in every cell.
Icons:
Left — two glass test tubes standing side by side, each filled with
two layers of colorful liquid (coral on top of teal in one, gold on
top of coral in the other).
Middle — a cheerful red car with a golden star on its hood, seen
slightly from above on a parking lot, blocked by a small mint-green
truck behind it.
Right — three rounded square tiles stacked in overlapping layers,
showing a strawberry, a banana and a watermelon slice.
Style: rounded flat vector icons for young children, thick smooth
outlines, soft limited pastel palette, simple bold silhouettes that
stay readable at 48 px.
Constraints: no text, no watermark, no grid lines between cells,
no drop shadows, no gradients.
```

参数：size `1536x512`（单格 512×512）、quality `high`、background
`transparent`（假透明则 `opaque` 白底）。

### lobby-f.png（纸牌，单格图标）

```text
Task: a single square icon for a children's game collection.
Composition: one playing card standing upright, slightly tilted,
cream-white face with a big red heart pip and rounded corners,
a second card face-down behind it in soft blue; a small golden
star badge at the top right corner.
Style: rounded flat vector icon for young children, thick smooth
outlines, soft limited pastel palette, simple bold silhouette
that stays readable at 48 px.
Constraints: no text, no watermark, no drop shadows, no gradients.
```

参数：size `1024x1024`（单图标不切格）、quality `high`、background
`transparent`（假透明则 `opaque` 白底）。

## 交付与验收

1. 四张 PNG 命名 lobby-a/b/c/d.png 发我即可；
2. 我负责：检查 alpha 通道是否真透明（棋盘格伪影退回白底重生成）、
   逐帧切割校验网格对齐、放进 `public/art/`、替换 `icons.ts` 手写
   SVG、Workbox 离线预缓存与 iPad 高分屏验证；
3. 某张网格切歪或某格画错，只重生成那一张。

# 游戏内素材（打地鼠 / 水排序，UI 升级第一批）

大厅图标用平面风（48px 可读优先）；游戏内素材改为「软胶玩具质感」——
有厚度、有柔光，但仍卡通圆润适合孩子。两套图各自的 Style 节一字不改，
同会话连生成保持风格统一。

## 打地鼠（whack-mole）

| 文件 | 内容 | 网格 | size 参数 | 单格/尺寸 |
| --- | --- | --- | --- | --- |
| whack-moles.png | 地鼠 4 态 | 2 列 × 2 行 | `1024x1024` | 512×512 |
| whack-hole.png | 立体土丘洞 | 单元素 | `1024x512` | 横幅 |
| whack-bg.png | 草地场景背景 | 单张整图 | `1536x1792` | 768×900 画布拉伸 |

### whack-moles.png（地鼠四态）

```text
Task: character sprite sheet for a children's whack-a-mole game.
Grid: exactly 4 equal square cells, 2 columns by 2 rows, one mole per
cell, centered, each mole filling about 75% of its cell, same scale
and same body proportions in every cell.
Sprites:
Row 1 — 1) a chubby brown mole popping up chest-high, big happy eyes,
rosy cheeks, two little paws resting on the ground, mouth open in a
cheerful grin; 2) the same mole dizzy after being bonked: eyes as
little stars, tongue slightly out, three tiny stars circling above
its head, keeping the same pose and proportions.
Row 2 — 3) a baby mole wearing a blue nightcap with a white pom-pom,
eyes peacefully closed, tiny "zzz" floating beside the cap; 4) the
same nightcap baby mole startled awake, eyes wide open, mouth a
small surprised o, one paw lifting the nightcap.
Style: soft 3D toy-like rendering for young children, rounded plump
shapes, matte plastic-toy surface with gentle top light and soft
ambient occlusion, warm pastel palette with rich brown fur, clean
silhouette, no texture noise.
Constraints: the "zzz" letters appear only beside the nightcap in
cell 3; no other text anywhere; no watermark, no grid lines between
cells, no background scenery, plain transparent background behind
each character.
```

参数：quality `high`、background `transparent`（假透明退 `opaque` 白底，
接入端整格圆角徽章兜底，不抠图）。

### whack-hole.png（土丘洞）

```text
Task: a single game prop for a children's whack-a-mole game.
Composition: one grassy mound viewed slightly from above, a soft
rounded hill of layered green grass with a dark brown oval burrow
opening in its center front, a few tiny grass blades and two small
daisies on the rim, the hole interior a warm dark gradient so a mole
can peek out of it.
Style: soft 3D toy-like rendering for young children, rounded plump
shapes, matte plastic-toy surface with gentle top light, warm pastel
greens, clean silhouette, no texture noise.
Constraints: single mound centered with clear margins all around;
no mole, no text, no watermark, no frame, plain transparent
background.
```

参数：quality `high`、background `transparent`（同上兜底）。

### whack-bg.png（场景背景）

```text
Task: a full background painting for a children's whack-a-mole game,
portrait orientation.
Composition: a sunny backyard lawn filling the whole frame — short
soft green grass with subtle mowing stripes in the lower two thirds,
a low wooden picket fence and two round bushes along the horizon,
clear sky with three fluffy clouds and a smiling sun in the top
third; the center area of the lawn stays mostly open and even, as
game holes will be placed there by code.
Style: soft 3D toy-like rendering for young children, rounded plump
shapes, matte surfaces with gentle top light, warm cheerful pastel
palette, airy and calm, no harsh contrast.
Constraints: no characters, no holes, no mounds, no UI, no text,
no watermark, no border; the lawn center is clear of any object.
```

参数：quality `high`、background `opaque`（整图背景无需透明）。

## 水排序（water-sort）

| 文件 | 内容 | 网格/形式 | size 参数 | 说明 |
| --- | --- | --- | --- | --- |
| water-tube.png | 试管管身 | 单元素竖图 | `512x1536` | 不透明玻璃管，作水层底图 |
| water-tube-gloss.png | 玻璃高光覆盖 | 单元素竖图 | `512x1536` | 两侧高光+管口沿，中部透明 |
| water-bg.png | 桌面场景背景 | 单张整图 | `1536x1792` | 768×900 画布 |

渲染次序（接入时）：背景 → 管身 → 程序色水层 → 高光覆盖 → 管口沿。
水色仍由代码绘制，精灵只提供玻璃质感。

### water-tube.png（管身）

```text
Task: a single game prop for a children's water sorting puzzle.
Composition: one empty glass test tube standing upright, closed
rounded bottom and open top, seen straight from the front; frosted
pale-aqua glass with subtle vertical transparency, a soft inner rim
shadow at the open mouth, the inner area lighter so colored liquid
drawn over it will stay readable; tube width about one third of the
image height's proportion, centered with clear margins.
Style: soft 3D toy-like rendering for young children, rounded plump
shapes, smooth glass with gentle top light and soft reflections,
warm pastel palette, clean silhouette.
Constraints: the tube is completely empty — no liquid inside; single
tube only; no text, no watermark, no frame, plain transparent
background around the tube.
```

### water-tube-gloss.png（高光覆盖）

```text
Task: a transparent overlay for a children's water sorting puzzle.
Composition: only two narrow vertical glossy highlight stripes, one
near the left edge and one thinner near the right edge of an
invisible upright test tube shape, plus a soft elliptical rim highlight
at the open top; everything except these highlights is fully
transparent, so colored liquid underneath stays visible.
Style: soft glass gloss for young children, airy white highlights
with smooth rounded ends, no color tint.
Constraints: highlights only, no tube outline, no liquid, no text,
no watermark; fully transparent background elsewhere.
```

### water-bg.png（背景）

```text
Task: a full background painting for a children's water sorting
puzzle, portrait orientation.
Composition: a cozy kitchen counter scene — a warm honey-wood
tabletop filling the lower two thirds with soft even lighting and
gentle plank seams, a blurred sunny window with a plant on the
windowsill and cream wall tiles in the upper third; the table center
stays calm and uncluttered, as glass tubes will be placed there by
code.
Style: soft 3D toy-like rendering for young children, rounded shapes,
matte surfaces with gentle top light, warm pastel palette, cozy and
calm, no harsh contrast.
Constraints: no tubes, no bottles, no hands, no UI, no text, no
watermark, no border; the table center is clear of any object.
```

参数：三张均 quality `high`；water-tube / water-tube-gloss 用
background `transparent`（假透明退白底：管身可直接用；高光图若退白底则
接入端改用「screen 混合模式」压白，不抠图）；water-bg 用 `opaque`。

## 第三批候选（点泡泡 / 红包雨 / 叠叠消）

沿用「软胶玩具质感」风格节；同批同会话生成。

### pop-bubbles（点泡泡）

| 文件 | 内容 | 形式 | size |
| --- | --- | --- | --- |
| pop-bubbles-sheet.png | 泡泡四色＋金色 | 2×3 网格（6 格用 5） | `1536x1024` |
| pop-bubbles-bg.png | 浴室/晴空泡泡背景 | 单张整图 | `1536x1792` |

```text
Task: sprite sheet for a children's bubble popping game.
Grid: exactly 6 equal square cells, 3 columns by 2 rows, one bubble
per cell, centered, each bubble about 70% of its cell, same scale.
Sprites: five glossy soap bubbles — 1) sky-blue, 2) pink, 3) yellow,
4) mint-green, 5) golden with tiny sparkles (the rare one); cell 6
left empty with nothing in it.
Style: soft 3D toy-like rendering for young children, rounded plump
shapes, iridescent soap-bubble shine with gentle top light, warm
pastel palette, clean silhouettes.
Constraints: no text, no watermark, no grid lines between cells,
plain transparent background behind each bubble.
```

```text
Task: a full background painting for a children's bubble popping
game, portrait orientation.
Composition: a bright sunny sky filling the frame — soft gradient
blue with three fluffy clouds and a distant green meadow strip at
the very bottom; a few faint tiny bubbles drifting up the sides;
the center stays open and airy for gameplay.
Style: soft 3D toy-like rendering for young children, rounded
shapes, gentle top light, warm cheerful pastel palette, calm and
airy.
Constraints: no characters, no UI, no text, no watermark; center
clear of large objects.
```

### red-rain（红包雨）

| 文件 | 内容 | 形式 | size |
| --- | --- | --- | --- |
| red-rain-sheet.png | 红包两态＋炮仗＋金币 | 2×2 网格 | `1024x1024` |
| red-rain-bg.png | 节日街景背景 | 单张整图 | `1536x1792` |

```text
Task: sprite sheet for a children's lucky envelope catching game.
Grid: exactly 4 equal square cells, 2 columns by 2 rows, one object
per cell, centered, about 65% of each cell, same scale.
Sprites: 1) a red Chinese lucky envelope with a golden coin seal,
closed; 2) the same envelope burst open with golden light and two
coins leaping out; 3) a red firecracker with a small spark on its
fuse (the one to avoid); 4) a shiny gold coin with a square hole.
Style: soft 3D toy-like rendering for young children, rounded plump
shapes, matte paper-and-gold surfaces with gentle top light, warm
festive palette, clean silhouettes.
Constraints: no text on the envelope besides the coin-shaped seal,
no letters anywhere, no watermark, no grid lines, plain transparent
background behind each object.
```

```text
Task: a full background painting for a children's lucky envelope
game, portrait orientation.
Composition: a festive night street with warm lanterns strung
across the top, softly glowing windows of low shops along both
sides, dark plum-purple sky with tiny stars; the center stays open
for falling envelopes.
Style: soft 3D toy-like rendering for young children, rounded
shapes, warm lantern glow, cozy and calm, not loud.
Constraints: no characters, no envelopes drawn in the sky, no UI,
no text, no watermark; center clear.
```

### tile-match（叠叠消）

| 文件 | 内容 | 形式 | size |
| --- | --- | --- | --- |
| tile-match-sheet.png | 牌面八种 | 3×3 网格（9 格用 8） | `1536x1536` |
| tile-match-bg.png | 客厅桌面背景 | 单张整图 | `1536x1792` |

```text
Task: sprite sheet for a children's tile matching game.
Grid: exactly 9 equal square cells, 3 columns by 3 rows, one tile
per cell, centered, each tile about 80% of its cell, same scale.
Sprites: eight rounded square tiles like thick game pieces —
1) strawberry, 2) banana, 3) watermelon slice, 4) green apple,
5) grape cluster, 6) orange, 7) blueberry muffin, 8) honey jar;
cell 9 left empty.
Style: soft 3D toy-like rendering for young children, rounded plump
shapes, matte candy-like colors with gentle top light and soft
shadow under each tile, clean silhouettes readable at 40 px.
Constraints: no text, no watermark, no grid lines between cells,
plain transparent background around each tile.
```

```text
Task: a full background painting for a children's tile matching
game, portrait orientation.
Composition: a cozy living-room table viewed slightly from above —
a warm wooden tabletop with a soft tablecloth covering the lower
two thirds, a blurred sofa and bookshelf along the top edge; the
table center stays open and uncluttered for tiles.
Style: soft 3D toy-like rendering for young children, rounded
shapes, gentle top light, warm pastel palette, cozy and calm.
Constraints: no tiles, no objects on the table center, no UI, no
text, no watermark.
```

## 交付与验收（游戏内素材）

1. 五张 PNG（whack-moles / whack-hole / whack-bg / water-tube /
   water-tube-gloss / water-bg 共六张）发我即可；
2. 我负责：网格对齐校验、按上述渲染次序接入、768×1024 与 1024×768
   双方向视觉验收、离线预缓存与体积检查；
3. 单张不满意只重生成那张，四态地鼠要同会话连出保持同一只鼠。

## 网格不齐时的补救（追加到原提示词末尾重生成）

```text
Important: keep all cells exactly the same size and perfectly
aligned to an invisible grid, with equal gaps between cells; do not
let any object cross a cell boundary.
```
