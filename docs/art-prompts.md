# 定制美术素材清单与生成提示词

给 GPT Image（ChatGPT 网页版或 gpt-image-1 API）生成游戏素材用的规格与提示词。
目标：一套统一的卡通风格，替代当前程序化绘制的图形，解决高倍屏幕上发糊的问题。

## 生成参数建议

| 项 | 建议 |
| --- | --- |
| 尺寸 | 全部 1024×1024（精灵图网格能整除切割） |
| 背景 | **纯白背景**即可（提示词已写明）；透明背景生成的边缘容易有杂色，白底由我统一去底 |
| 质量 | 选最高质量档；一次不满意就整张重生成，不要局部修（会破坏网格对齐） |
| 风格锚 | 所有提示词共享同一段风格描述，保证 20 张图风格一致 |

## 素材总览

| 精灵图 | 内容 | 网格 | 帧数 | 服务游戏 |
| --- | --- | --- | --- | --- |
| fruits-small.png / fruits-big.png | 带表情脸的水果 11 种 + 炸弹 | 各 3 列 × 2 行 | 各 6 | 已接入：合成水果、切水果 |
| half-fruits.png | 半果切面（D 形平边朝左）6 种 | 3 列 × 2 行 | 6 | 切水果（另一半代码镜像） |
| packets.png | 红包、金色炮仗 | 2 列 × 1 行 | 2 | 红包雨 |
| moles.png | 棕色地鼠、睡觉地鼠 | 2 列 × 1 行 | 2 | 打地鼠 |
| bubbles.png | 蓝色泡泡、金色泡泡 | 2 列 × 1 行 | 2 | 点泡泡 |
| 大厅图标 | 20 个游戏图标 | 逐张生成 | 20 | 大厅 |

游戏内精灵图帧切割规格（我接入时按此切）：
fruits 每帧 256×341；packets / moles / bubbles 每帧 512×512。

## 提示词 A：fruits.png（水果 + 炸弹，合成水果与切水果共用）

```text
Sprite sheet for a children's game, 4 columns and 3 rows grid of 12 equal
rectangular cells on a plain solid white background. One object per cell,
consistent kawaii flat cartoon style across all cells: thick smooth dark
outlines, soft cel shading, glossy highlights, cheerful bright colors.
Every object is a whole round fruit with a cute happy face (two dot eyes
and a small smile), all objects the same size, centered in their own cell,
occupying about 70% of the cell, perfectly aligned to the grid.
Row 1: two shiny red cherries joined by green stems with one leaf; a red
strawberry with tiny yellow seeds and a green leafy top; a purple grape
cluster with a short brown stem; a round orange mandarin with a small bump
on top and one green leaf.
Row 2: a round orange persimmon with a green four-petal calyx on top; a
red apple with a short brown stem and one green leaf; a golden-yellow pear
with a long brown stem and light speckles; a soft pink peach with a gentle
vertical crease and one small pointed leaf.
Row 3: a golden pineapple with diamond crosshatch skin and a green spiky
crown; a round pale-green melon covered in fine cream netting; a big whole
watermelon with dark green wavy stripes on light green rind; a round black
cartoon bomb with a short rope fuse and a small orange spark.
No text, no numbers, no letters, no watermark, no borders, no grid lines,
no drop shadows outside the objects. Flat 2D front view, vector style.
```

## 提示词 A2：half-fruits.png（切水果的半果切面）

背景说明：当前切开效果是整果遮罩模拟，切面没有果肉。这张图让切开
的两半露出真实果肉；另一半在代码里水平镜像，不必画两份。

```text
Sprite sheet for a fruit-slicing arcade game. Plain white background,
3 columns × 2 rows grid of 6 equal square cells.

Scene context: in the game, a blade slices a whole fruit vertically
down the middle, and the fruit splits into two identical halves that
fly apart. Each cell shows the LEFT half of a fruit right after that
slice, as if the right half has just been carried away by the blade:
a D-shaped half fruit in SIDE VIEW, with the FLAT CUT FACE on the left
showing the juicy interior (flesh, seeds, pit) and the rounded outer
skin on the right. It must NOT be a full round cross-section viewed
from above, NOT a whole fruit — only the left half.

Style: kawaii flat cartoon, thick smooth outlines, soft cel shading,
glossy highlights. All halves exactly the same size, centered,
occupying about 60% of the cell, clear white gaps between cells.
Cell 1: half watermelon — light green striped rind, red flesh with
black seeds on the cut face.
Cell 2: half strawberry — red skin, pale pink flesh with tiny seeds.
Cell 3: half mandarin orange — orange skin, segmented juicy flesh.
Cell 4: half apple — red skin, cream flesh, two small brown seeds.
Cell 5: half peach — pink skin, golden flesh, wrinkled pit on the cut.
Cell 6: half pineapple — golden diamond-pattern skin, yellow flesh.
No cute faces. No text, no numbers, no watermark, no borders, no grid
lines, no drop shadows. Flat 2D, vector style.
```

注意「No cute faces」：切面是果肉特写，不需要表情（整果保留表情）。

### A2 的替代做法：用「图片编辑」而不是从零生成（推荐）

文字凭空生成"侧视半果"成功率低（模型见过的多是横截面圆图）。改用
GPT-Image 的编辑功能：**上传 `public/art/fruits-big.png` / `fruits-small.png`
中合格的整果格**（或直接上传整图），用下面这段指令，让它在已有水果上改：

```text
Edit this sprite sheet: for each fruit in the grid, cut it vertically
in half and KEEP ONLY THE LEFT HALF. The left half must keep its
rounded skin on the right side and show the flat cut face on the left
with juicy flesh, seeds and pit visible on that flat side (watermelon:
red flesh with black seeds; strawberry: pale pink flesh; mandarin:
segmented orange flesh; apple: cream flesh with two brown seeds;
peach: golden flesh with a wrinkled pit; pineapple: yellow flesh).
Do not change anything else: keep the same grid positions, same sizes,
same style, same white background. No whole fruits, no round top-view
cross-sections, no faces, no text.
```

编辑模式继承了原图的布局与风格，只需要它执行"切掉右半"这一个动作，
这是它擅长的。## 提示词 B：packets.png（红包雨）

```text
Sprite sheet with exactly 2 equal square cells side by side (1 row,
2 columns) on a plain solid white background. Kawaii flat cartoon style,
thick smooth outlines, soft cel shading, glossy highlights. One object
per cell, centered, occupying about 70% of the cell, same size.
Left cell: a red Chinese New Year money envelope standing upright, warm
red paper with a golden border and a round golden seal on the flap.
Right cell: a festive red-and-gold firecracker stick tilted slightly,
with golden bands and a lit golden fuse ending in a small orange spark.
No text, no numbers, no letters, no watermark, no borders, no grid lines,
no drop shadows. Flat 2D, vector style.
```

## 提示词 C：moles.png（打地鼠）

```text
Sprite sheet with exactly 2 equal square cells side by side (1 row,
2 columns) on a plain solid white background. Kawaii flat cartoon style,
thick smooth outlines, soft cel shading. One object per cell, centered,
occupying about 70% of the cell, same size: two cute chubby moles shown
from the chest up, as if peeking out of a hole.
Left cell: a warm brown mole with a big pink nose, rosy cheeks, wide happy
eyes and tiny white paws waving.
Right cell: a gray mole wearing a blue striped nightcap with a white pom,
eyes peacefully closed, gentle sleeping smile, tiny "zzz" is NOT allowed.
No text, no numbers, no letters, no watermark, no borders, no grid lines,
no drop shadows. Flat 2D, vector style.
```

## 提示词 D：bubbles.png（点泡泡）

```text
Sprite sheet with exactly 2 equal square cells side by side (1 row,
2 columns) on a plain solid white background. Glossy cartoon style with
smooth outlines and bright highlights. One object per cell, centered,
occupying about 80% of the cell, same size.
Left cell: a large translucent sky-blue soap bubble with a soft gradient,
a bright white crescent highlight in the upper left and a thin rainbow
sheen at the bottom edge.
Right cell: the same bubble shape but glowing golden — warm amber gradient,
sparkling star highlights, a few tiny golden sparkles around it.
No text, no numbers, no letters, no watermark, no borders, no grid lines.
Flat 2D, vector style.
```

## 提示词 E：大厅图标（逐张生成，共 20 张）

统一模板（把 `{符号}` 换成下表内容）：

```text
A square app icon for a children's game collection, rounded corners,
soft cream background with a subtle warm gradient, centered flat cartoon
illustration of {符号}, kawaii style, thick smooth outlines, soft cel
shading, cheerful pastel colors, generous padding around the subject,
no text, no letters, no numbers, no watermark.
```

| 游戏 | {符号} |
| --- | --- |
| 2048 | two game tiles merging: a "4" tile and a "8" tile (numbers ARE allowed for this one icon only) |
| 五子棋 | one black and one white glossy go stone crossing on a wooden board corner |
| 俄罗斯方块 | colorful tetromino blocks (one L-shape, one T-shape) mid-fall |
| 合成水果 | a happy watermelon with a cute face |
| 空当接龙 | a single playing card with a big golden spade ace |
| 蜘蛛纸牌 | a friendly little spider sitting on a playing card |
| 扫雷 | a round cartoon landmine with a small red flag planted next to it |
| 记忆翻牌 | two playing-style cards, one face up one face down, with a golden star |
| 七巧板 | colorful tangram triangles forming a little house |
| 接水管 | two chunky pipe pieces (one elbow, one straight) in mint green |
| 推箱子 | a small wooden crate with a smiling face on a tile floor |
| 泡泡龙 | a cluster of three glossy bubbles (pink, blue, yellow) |
| 点泡泡 | a golden bubble being popped with a tiny star burst |
| 红包雨 | a red Chinese money envelope with golden seal, two gold coins beside it |
| 打地鼠 | a happy brown mole peeking out of a green hole |
| 切水果 | a watermelon slice with a white slash line and juice droplets |
| 解绳结 | a smooth tangled rope loop with one loose end lifted |
| 迷宫探险 | a top-view simple maze path with a small flag at the exit |
| 数织 | a grid of dark and light squares forming a heart pixel pattern |
| 数独 | a 3x3 mini grid with a few soft number tiles (numbers allowed for this icon) |

## 生成后怎么交付

1. 文件按上表命名（fruits.png、packets.png、moles.png、bubbles.png、
   icon-<游戏id>.png），发给我即可；
2. 我负责：去白底（近白像素转透明）、按网格切割校验、放进 `public/art/`、
   接入各游戏替换程序化纹理、Workbox 离线预缓存（png 已在
   `globPatterns` 中）与 iPad 高分屏验证；
3. 如果某张精灵图网格切歪（AI 偶尔会把格子画得大小不一），我会指出具体
   哪几格不对，单独重生成那一张即可，不必全部重来。

## 网格不齐时的补救提示词（追加到原提示词末尾重生成）

```text
Important: keep all 12 cells exactly the same size and perfectly aligned
to an invisible grid, with equal gaps between cells; do not let any object
touch or overflow its cell.
```
