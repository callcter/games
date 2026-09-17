# 小树游戏屋 Experience 2.0 改造方案

> 目标：把「20+ 个规则正确、都能玩的小游戏」升级成「8 岁孩子愿意反复打开、每个游戏都有玩具感的个人游戏机」。
>
> 本方案以仓库 `https://github.com/callcter/games` 当前 `main` 分支（2026-09-17）为基线。
> 第一阶段不新增游戏、不改变核心规则、不引入后端、不引入广告/统计/登录，不依赖远程素材。

---

## 0. 一句话结论

当前项目的主要瓶颈已经不是规则、工程质量或游戏数量，而是：

1. **输入仍然偏“操作 UI”，而不是“直接摆弄玩具”**；
2. **公共层统一了视觉表现，而不是只统一底层能力**；
3. **触摸后的反馈密度不足，动作—结果之间缺少连续的视觉/声音/运动反馈**；
4. **大厅更像 App Launcher，而不是孩子的“游戏屋”**；
5. **缺少让多个小游戏组成一个整体世界的轻量长期成长感**。

Experience 2.0 的核心原则：

> **复用能力，不复用表现；保留 core，重做 feel。**

---

# 1. 当前状态审计

## 1.1 已经做得很好的部分

仓库现有基础不应该推翻。

### 工程层

- TypeScript 严格模式；
- Phaser 4.2；
- 规则与场景分层；
- 多数新游戏拥有纯 `core`；
- Vitest 规则测试；
- 浏览器真实回归；
- 离线 PWA；
- iPad 优先；
- IndexedDB / localStorage 存档；
- 动态 import；
- High DPI；
- 完整销毁生命周期；
- 无广告、无账号、无追踪、无远程素材。

这些都应该继续保留。

### 产品层

当前已经有 20+ 个可玩游戏，覆盖：

- 数字逻辑；
- 图形空间；
- 动作反应；
- 棋类纸牌；
- 物理合成；
- 亲子玩法。

因此 **Experience 2.0 暂停增加新游戏**。

接下来所有投入用于：

> 输入手感 → 反馈 → 流程 → 内容 → 大厅 → 长期成长。

---

# 2. 当前体验问题的代码根源

## 2.1 `PuzzleScene` 同时承担了“基础能力”和“视觉表达”

当前：

```text
PuzzleScene
├── 生命周期
├── audio unlock
├── draft flush
├── 返回按钮
├── 游戏标题
├── 声音按钮
├── status
├── button()
├── text()
└── celebrate()
```

其中前四项是基础能力。

但后面的：

- 固定米色背景；
- 固定标题布局；
- 固定按钮；
- 固定状态栏；
- 固定 `✦ 太棒啦 ✦`；

已经进入了**具体视觉表现**。

结果是不同游戏很容易拥有相同“壳”。

### Experience 2.0 原则

公共层负责：

```text
生命周期
输入
动画 primitive
粒子池
音频 cue
拖拽约束
浮字
转场
资源管理
```

游戏自己决定：

```text
按钮长什么样
成功怎么庆祝
失败怎么表现
背景是什么
物体怎么移动
结果页怎么呈现
```

---

## 2.2 `ActionScene extends PuzzleScene` 耦合过强

当前动作游戏：

```text
ActionScene
    ↓
PuzzleScene
```

因此动作游戏天然继承益智游戏的：

- header；
- 状态栏；
- intro；
- 难度按钮；
- 结算风格。

长期应该调整为：

```text
                GameSceneBase
                /           \
       PuzzleScene        ActionScene
```

但是：

> **第一阶段不要一次性重构全部游戏。**

先以兼容方式增加 Experience 层。

三个旗舰游戏验证成功以后，再拆继承关系。

这样可以避免“为了架构漂亮，把 20 个游戏全部弄坏”。

---

# 3. Experience 2.0 新架构

建议新增：

```text
src/
├── experience/
│   ├── feedback/
│   │   ├── motion.ts
│   │   ├── particles.ts
│   │   ├── floating-text.ts
│   │   ├── response.ts
│   │   └── types.ts
│   │
│   ├── input/
│   │   ├── axis-drag.ts
│   │   ├── drag-session.ts
│   │   └── pointer-utils.ts
│   │
│   ├── celebration/
│   │   ├── director.ts
│   │   └── primitives.ts
│   │
│   ├── transitions/
│   │   └── scene-transition.ts
│   │
│   └── tutorial/
│       └── gesture-coach.ts
│
├── games/
│   ├── puzzle-kit/
│   ├── action-kit/
│   └── ...
│
└── app/
```

注意：

**不要建立一个 `feedback.success()`，然后 20 个游戏全部播放相同动画。**

正确方式是提供 primitive：

```ts
motion.press(...)
motion.pickup(...)
motion.snap(...)
motion.bump(...)
motion.pop(...)
particles.burst(...)
floatingText.show(...)
celebration.emit(...)
```

然后由每个游戏组合。

例如：

```ts
// 停车场
motion.snap(car)
audio.playCarSnap()
particles.dust(...)

// 数独
motion.pop(cell)
audio.playPlace(...)
highlightRow(...)

// 水排序
motion.tilt(tube)
animateLiquid(...)
audio.playPour(...)
```

公共能力一致，游戏表现不同。

---

# 4. Feedback Primitive 设计

## 4.1 Motion

建议第一版只实现几个高复用 primitive。

```ts
export interface Motion {
  press(target: Phaser.GameObjects.GameObject): void
  release(target: Phaser.GameObjects.GameObject): void

  pickup(
    target: Phaser.GameObjects.Components.Transform,
    options?: PickupOptions
  ): Phaser.Tweens.Tween

  snap(
    target: Phaser.GameObjects.Components.Transform,
    x: number,
    y: number,
    options?: SnapOptions
  ): Phaser.Tweens.Tween

  bump(
    target: Phaser.GameObjects.Components.Transform,
    axis: 'x' | 'y',
    direction: -1 | 1
  ): Phaser.Tweens.Tween

  pop(
    target: Phaser.GameObjects.Components.Transform,
    scale?: number
  ): Phaser.Tweens.Tween
}
```

第一版时长建议：

| 动作 | 大致时间 |
|---|---:|
| press | 60–90ms |
| pickup | 90–140ms |
| snap | 140–220ms |
| reject/bump | 120–180ms |
| pop | 160–240ms |
| 小成功反馈 | 300–600ms |
| 大成功反馈 | 700–1200ms |

原则：

> 玩家的手已经离开以后，不要为了播放动画锁操作 1 秒。

动画服务于手感，不是阻止操作。

---

# 5. Direct Manipulation 系统

这是第一阶段最重要的基础能力。

## 5.1 为什么先做这个

现在停车场的规则是正确的，但操作是：

```text
点汽车
↓
显示合法位置
↓
点目标位置
```

孩子是在“告诉程序我要移动汽车”。

体验目标：

```text
按住汽车
↓
汽车被拿起来
↓
跟着手指移动
↓
遇到障碍停住
↓
松手
↓
吸附
```

孩子是在“移动汽车”。

两者的规则完全相同，但体验差别巨大。

---

## 5.2 `AxisDragController`

第一版建议只解决停车场，不要做一个万能拖拽框架。

```ts
interface AxisDragConfig {
  axis: 'x' | 'y'

  getStops(): readonly DragStop[]

  onPickup(): void

  onMove(position: number): void

  onBlocked(direction: -1 | 1): void

  onCommit(stop: DragStop): void

  onCancel(): void
}
```

`DragStop`：

```ts
interface DragStop {
  logical: number
  pixel: number
}
```

关键思想：

### 拖动过程中

只改：

```text
Phaser display object position
```

不要修改 core state。

### 松手时

选择最近合法 stop：

```ts
slide(state, carId, logicalTarget)
```

只有这一刻提交 core。

这样：

- 现有 BFS；
- 合法移动；
- 步数；
- 存档；
- undo；

全部不需要改变。

---

# 6. 旗舰游戏 1：停车场

停车场是整个 Experience 2.0 的第一块试验田。

## 6.1 当前问题

目前 `scene.ts`：

- 每辆车创建 hit area；
- 点车后计算 `legalTargets()`；
- 为合法格创建 rectangle；
- 再点目标调用 `move()`；
- `move()` 后调用 `draw()`；
- 基本等价于重新生成整张棋盘。

这适合作为功能实现。

不适合作为成品手感。

---

## 6.2 Experience 2.0 操作模型

### pointerdown

```text
车体轻微放大
阴影/高亮出现
播放 pickup 音效
记录 pointer offset
```

视觉：

```text
scale 1.00 → 1.035
```

不要夸张。

---

### pointermove

汽车只能沿自身方向移动：

```text
横车：x
竖车：y
```

根据 `legalTargets()` 得到合法范围。

在像素空间转换为：

```text
minPixel ≤ carPosition ≤ maxPixel
```

手指超过范围：

```text
汽车停在边界
```

可以允许 6–10 px 的“橡皮筋”视觉位移，再回弹。

这样孩子会产生：

> “被前面的车挡住了”

而不是：

> “程序不允许我移动”。

---

### pointerup

找到最近合法目标。

如果移动：

```text
snap
↓
play car click
↓
commit slide()
↓
remember()
```

如果没有移动：

```text
轻微落回
```

---

## 6.3 红车成功

当前成功已经有“驶出出口”的 tween。

Experience 2.0 改为：

```text
红车移动到出口
↓
短暂停顿 80ms
↓
加速冲出
↓
出口方向小粒子
↓
道路/箭头亮起
↓
成功音阶
↓
游戏区域仍留在背景
↓
结果卡从底部弹出
```

不要：

```text
清空场景
↓
显示统一“太棒啦”
```

---

## 6.4 停车场第一版明确不做

不要在 Sprint 1 同时：

- 改生成算法；
- 改 BFS；
- 加新关卡模式；
- 加金币；
- 加星级系统；
- 重写 core；
- 重画所有汽车美术。

只解决：

> **汽车真的像汽车一样被拖。**

---

## 6.5 验收标准

必须满足：

- 单指按住车直接拖；
- 不再要求先选车再点目标；
- 一次拖动可以跨多个合法格；
- 不能穿过其他车；
- 不能横车竖拖；
- 松手吸附到合法格；
- 单次拖动只计 1 步；
- undo 行为不变；
- 存档行为不变；
- BFS/PAR 不变；
- 胜利判定不变；
- 拖动期间不整盘 `draw()`；
- iPad Safari 连续拖动无明显跳动；
- 768×1024 可用；
- 横屏仍能正常操作。

---

# 7. 旗舰游戏 2：合成水果

合成水果现有基础已经很好。

已有：

- Matter；
- 水果纹理；
- 不同水果视觉特征；
- merge 动画；
- 水果碰撞；
- 危险线；
- 下一颗；
- 得分；
- 游戏结束。

因此这里不应该重做游戏。

重点是：

> **让一次普通合并变爽，让一次连锁合并非常爽。**

---

## 7.1 投放手感

当前：

```text
点击位置
↓
spawnFruit()
```

升级为：

```text
pointerdown
↓
当前水果预览跟手
↓
横向移动
↓
释放
↓
水果落下
```

仍然只允许在顶部投放区域横向移动。

建议增加：

- 很淡的垂直落点线；
- 落点投影；
- 松手时预览轻缩；
- 真水果生成时轻微 drop impulse。

不要做精确瞄准辅助。

让它保持玩具感。

---

## 7.2 Merge Feedback

现在 merge 已经有：

```text
旧水果消失
新水果放大
音效
```

继续加三层：

### 第一层：接触

两个相同水果碰撞瞬间：

```text
scale 0.96
```

非常短。

### 第二层：生成

```text
0.82 → 1.10 → 1.00
```

比当前单纯变大更有弹性。

### 第三层：结果

在 merge 点产生：

```text
小光点
+分浮字
圆环
```

不要让粒子遮住水果。

---

## 7.3 连锁合并

第一阶段：

**不要修改计分规则。**

只做表现连锁：

```text
500~700ms 内连续 merge
```

显示：

```text
连锁！
连锁 ×2
连锁 ×3
```

并逐渐提高：

- 音调；
- 粒子数量；
- pop 大小。

这可以只存在 scene 层。

不需要改 core。

---

## 7.4 大水果重量感

不同尺寸水果不应该只有“半径不同”。

表现上可以：

- 大水果碰撞时更低沉；
- 落地让 bowl 轻微震动；
- 最大两档水果产生极轻 camera shake；
- 小水果声音更清脆。

注意 shake 极轻。

孩子不能因为视觉晃动看不清局面。

---

## 7.5 危险线

当前危险线变色。

升级为：

```text
安全：
淡

接近危险：
缓慢呼吸

持续越线：
更明显的 pulse + 低频提示音
```

不要高频报警。

不要制造焦虑。

---

## 7.6 游戏结束

不要完全替换画面。

保留水果堆作为背景。

覆盖：

```text
水果堆满啦

这次：XXX
最好：XXX

[ 再玩一次 ]

[ 回游戏屋 ]
```

“再玩一次”是第一主按钮。

---

# 8. 旗舰游戏 3：切水果

切水果目前应该作为全项目的 Game Feel 基准。

已经拥有：

- 跟手刀光；
- whoosh；
- 线段切割判定；
- 半果分离；
- 果汁/粒子；
- combo 浮字；
- bomb shake。

它不需要“大修”。

它需要解决的是：

> **动作游戏从开始到结束的完整体验。**

---

## 8.1 Intro

当前 ActionScene 的体验是：

```text
标题
玩法文字
三个难度按钮
```

更像设置页。

建议切水果改为自定义 intro：

```text
       切水果

    [水果动画]

   手指划过水果

      [开始]

   难度：普通 >
```

首次进入可以播放 1 次：

```text
ghost finger swipe
```

之后不再强制显示。

---

## 8.2 Round Start

点击开始后：

```text
3
2
1
开始！
```

总长度控制在约 1.5 秒。

或者更轻：

```text
准备
↓
开始！
```

不要阻塞太久。

---

## 8.3 HUD

不要再使用 puzzle status sentence：

```text
分数 22 · 已切 18 个 · 剩余 38.4 秒
```

建议拆成视觉块：

```text
22
分数

        38s
```

连续切：

```text
×3
```

临时出现在游戏区域。

---

## 8.4 Result Overlay

当前 `ActionScene.endRound()` 会 `resetView()`。

这意味着：

> 游戏世界消失 → 进入统一结算页。

Experience 2.0：

```text
游戏停止
↓
最后一帧留在背景
↓
背景轻微变暗
↓
成绩卡从下方出现
```

这一个改变会显著增加“完整游戏”的感觉。

---

# 9. ActionScene 第二阶段改造

旗舰游戏验证完后，再调整 ActionScene。

目标：

```text
GameSceneBase
├── 生命周期
├── audio unlock
├── safe cleanup
└── exit

ActionScene
├── timer
├── score session
├── round lifecycle
└── result hooks
```

提供 hook：

```ts
protected showIntro(): void

protected showRoundStart(): void

protected showHud(): void

protected showResult(result: RoundResult): void
```

子游戏可以覆写。

默认模板仍然存在，避免一次改完全部动作游戏。

---

# 10. 大厅：从 App Launcher 变成“小树游戏屋”

当前大厅的信息架构：

```text
标题
没有广告 · 随时离线
检查更新
整理图标
最近玩过
分类
全部图标
```

这对成人很好。

对孩子不够有“家”的感觉。

---

# 11. Home 2.0

建议首页结构：

```text
┌──────────────────────────┐
│        🌳 小树游戏屋       │
│                          │
│      今天想玩什么？        │
│                          │
│   [继续玩：停车场]         │
│                          │
├──────────────────────────┤
│ 🧠 动脑筋   🎨 拼一拼      │
│ ⚡ 手要快   👨‍👩‍👧 一起玩  │
├──────────────────────────┤
│        最近玩过           │
│   ○     ○     ○     ○    │
├──────────────────────────┤
│        所有游戏           │
│  ○ ○ ○ ○                 │
│  ○ ○ ○ ○                 │
└──────────────────────────┘
```

---

## 11.1 分类文案

从：

```text
全部游戏
数字逻辑
图形路线
轻松反应
棋类纸牌
```

逐步调整为孩子语言：

```text
全部
动脑筋
拼一拼
手要快
一起玩
```

注意：

“棋类纸牌”仍然可以作为内部 Category。

UI 不需要暴露工程分类名称。

---

## 11.2 管理功能

以下内容：

```text
检查更新
整理图标
版本信息
```

全部移入：

```text
设置 / 家长
```

主页只保留：

- 自动更新 toast；
- 非阻塞的新版本提醒。

孩子不需要理解 Service Worker。

---

# 12. Home 的反馈

游戏卡片 pointerdown：

```text
scale 1 → 0.96
```

同时：

- 图标向下 1–2px；
- 阴影减弱；
- 很轻 UI click。

pointerup：

```text
0.96 → 1.03 → 1
```

随后卡片进入游戏。

可以做：

```text
selected card scale up
other cards fade
```

但不要做复杂页面转场。

PWA 首先要快。

---

# 13. “小树成长” Meta Game

这是 Experience 2.0 第二阶段。

**不要第一周就做。**

只有当旗舰游戏本身已经变好玩以后再加。

否则只是用奖励掩盖游戏手感问题。

---

## 13.1 设计目标

不做：

- 金币；
- 商店；
- 连续签到；
- 每日任务；
- 宝箱；
- 广告奖励；
- FOMO；
- 体力；
- 排名。

做：

> 孩子玩过的时间，在游戏屋里留下温和、永久的痕迹。

---

## 13.2 最小版本

每完成一个游戏的一个自然目标：

```text
获得 1 片叶子
```

例如：

```text
第一次通关停车场
第一次完成数独
切水果达到个人新纪录
完成一次七巧板
```

树的阶段：

```text
种子
↓
小芽
↓
小树
↓
枝叶
↓
开花
↓
小鸟
↓
树屋
```

不要倒退。

不要因为几天没玩就失去东西。

---

## 13.3 数据

继续本地保存。

例如：

```ts
interface TreeProgress {
  version: 1
  leaves: number
  unlocked: string[]
  milestones: Record<string, boolean>
}
```

不得上传。

---

# 14. 内容问题

Game Feel 解决“像不像游戏”。

内容解决“能玩多久”。

当前部分益智游戏内容量仍有限。

Experience 2.0 之后再做 Content Pass：

```text
七巧板
5 → 20+

推箱子
10 → 30+

数织
9 → 30+
```

不要随机堆数量。

按难度梯度：

```text
教学
↓
简单
↓
正常
↓
挑战
```

每 3～5 关出现一个有明显新意的局面。

---

# 15. 美术策略

你不需要先变成游戏美术师。

当前项目非常适合：

> 程序化 UI + 少量高价值角色/图标素材。

优先顺序：

### 1. 程序化

适合：

- 卡片；
- 按钮；
- 棋盘；
- 高光；
- 阴影；
- 粒子；
- 简单汽车；
- 管道；
- 格子。

### 2. SVG / sprite

适合：

- 首页游戏图标；
- 水果；
- 动物；
- 小树；
- 装饰。

### 3. 不值得精绘

不要为：

- 每个按钮；
- 每个格子；
- 每个提示框；

制作独立美术。

**动画和声音带来的收益通常比增加纹理细节更高。**

---

# 16. 音效架构

当前 `GameAudio` 已经拥有：

```text
playMove
playMerge
playWin
playGameOver
playRestart
playPlace
playPop
playBurst
playWhoosh
```

继续扩展时不要无限增加：

```text
playParkingCar
playParkingBump
playParkingVictory
playWaterPour
...
```

建议分两层：

```text
GameAudio
    ↓
底层合成能力

Game-specific cue
    ↓
由具体游戏组合调用
```

例如停车场：

```ts
const parkingAudio = {
  pickup: () => audio.playMove(),
  snap: () => audio.playPlace(1),
  blocked: () => ...
}
```

第一阶段不需要重构 GameAudio。

只增加确实缺少的底层声音 primitive。

---

# 17. 本地 Playtest Harness

这个项目最大的优势不是 AI。

是：

> 真实目标玩家就在家里。

建议加入一个开发模式：

```text
?playtest=1
```

只在本地开发使用。

记录：

```ts
interface PlaytestEvent {
  at: number
  type:
    | 'game-start'
    | 'first-input'
    | 'help'
    | 'undo'
    | 'restart'
    | 'win'
    | 'lose'
    | 'exit'
}
```

用途：

自动计算：

```text
进入 → 第一次操作时间
用了几次提示
用了几次撤销
多少秒退出
一局后是否立即再玩
```

数据：

```text
只保存在本机
不发送网络
开发模式默认关闭
```

甚至第一版不用写代码。

人工表格就足够。

---

# 18. 女儿 Playtest 标准流程

每次只测 1 个游戏。

爸爸不能告诉她怎么玩。

观察：

```text
1. 进入后多久开始第一次操作？
2. 有没有找不到“开始”？
3. 有没有连续点一个没反应的地方？
4. 有没有问“这个怎么弄？”
5. 有没有因为误操作生气？
6. 哪个动作让她笑？
7. 有没有主动说“再来一次”？
8. 玩完以后会不会主动换另一个？
```

不要问：

> 好玩吗？

问：

> 还玩吗？

这是更真实的指标。

---

# 19. Experience Quality Gate

以后每个游戏不仅通过：

```text
规则测试
浏览器测试
```

还需要通过 Experience Gate。

---

## 19.1 输入

- 核心玩法可单指完成；
- 可拖的东西优先直接拖；
- 玩家点击可交互物后 100ms 左右必须出现视觉或声音反馈；
- 不要求高精度点击；
- 不依赖 hover。

---

## 19.2 反馈

每个核心动作至少包含两种反馈：

```text
motion
sound
particle
color
text
```

中至少两个。

例如：

停车：

```text
移动 + 卡位声
```

不是：

```text
只改数据。
```

---

## 19.3 结果

成功不能只：

```text
setText("完成")
```

失败不能只：

```text
setText("失败")
```

结果必须体现：

```text
发生了什么
为什么结束
接下来能做什么
```

---

## 19.4 Replay

所有短局游戏：

```text
结束 → 再来一次
```

必须是一等路径。

不能让孩子：

```text
结束
↓
返回
↓
重新选游戏
↓
重新选难度
↓
开始
```

---

# 20. 性能预算

增加 feel 时要防止“动画越多越卡”。

现有原则继续保持：

- 粒子池复用；
- 不反复 new 大量对象；
- 不为每帧创建 Text；
- 不整盘重建；
- 不在 pointermove 中运行昂贵求解；
- 不因为拖动频繁写 IndexedDB；
- commit 后再存档；
- 高频音效限制声源数量。

特别是停车场：

```text
pointermove
```

绝对不能：

```text
solve()
draw()
save()
```

每帧执行。

---

# 21. 第一阶段实施顺序

这是最重要的一部分。

Codex 应严格按顺序执行。

---

## Sprint 0 — 建立基线

### 目标

不改变产品。

### 工作

- 阅读 `AGENTS.md`；
- 运行 `pnpm check`；
- 运行 `git diff --check`；
- 启动开发服务；
- 对以下游戏保存当前截图：
  - 大厅；
  - 停车场；
  - 合成水果；
  - 切水果；
- 实际玩每个游戏 2–3 分钟；
- 记录 current behavior；
- 不修改 core。

### 输出

```text
docs/experience-2-baseline.md
```

### Commit

```text
docs: capture experience 2 baseline
```

---

# 22. Sprint 1 — Feedback Foundation

## 目标

建立 Experience primitive。

### 新增

```text
src/experience/
├── feedback/
│   ├── motion.ts
│   ├── floating-text.ts
│   └── particles.ts
└── input/
    └── axis-drag.ts
```

### 要求

- 没有游戏行为改变；
- 无新 npm dependency；
- primitive 必须可单独销毁；
- Scene destroy 后不能保留 timer/listener/tween；
- API 不绑定某一个游戏。

### 测试

如果可提取纯计算：

```text
axis drag clamp
nearest stop
```

写 unit test。

### Commit

```text
refactor: add reusable game feel primitives
```

---

# 23. Sprint 2 — 停车场 Direct Manipulation

这是 Experience 2.0 的第一个真正成果。

### 修改

```text
src/games/parking/scene.ts
```

### 尽量不改

```text
src/games/parking/core/game.ts
```

### 实现

- pointerdown pickup；
- pointermove axis drag；
- legal range clamp；
- blocked feedback；
- release snap；
- commit `slide()`；
- victory exit；
- 保留 undo；
- 保留 save；
- 保留 BFS/PAR。

### 删除/弱化

原来的：

```text
点车
→ 出现目标格
→ 点目标格
```

可以保留作为 accessibility fallback，但不能是默认主操作。

### Commit

```text
feat: make parking cars directly draggable
```

---

# 24. Sprint 3 — 停车场 Polish

在 Direct Manipulation 正确以后才 polish。

### 加

- pickup scale；
- drop snap；
- blocked bump；
- car click；
- hero exit trail；
- 结果 overlay。

### 不加

- 新规则；
- 星级；
- 金币；
- meta progression。

### Commit

```text
feat: polish parking game feel
```

---

# 25. Sprint 4 — 合成水果 Polish

### 实现

- 预览水果跟手；
- release drop；
- drop guide；
- merge squash/pop；
- merge particle；
- score float；
- cosmetic chain counter；
- 大水果重量感；
- danger pulse；
- overlay game over。

### 不改

核心水果等级、半径、碰撞规则和 merge 规则。

### Commit

```text
feat: deepen merge fruit feedback
```

---

# 26. Sprint 5 — 切水果 Flow

### 实现

- 自定义 intro；
- 更简 HUD；
- round start；
- 保留背景的 result overlay；
- replay 主路径。

### 目标

切水果成为：

> 动作游戏体验模板

而不是代码模板。

### Commit

```text
feat: polish fruit slicer round flow
```

---

# 27. Sprint 6 — Home 2.0

只有三个 flagship 的 feel 成立以后再改大厅。

### 修改

```text
src/app/app.ts
src/app/library.ts
src/app/styles.css
```

### 实现

第一版只做：

```text
继续玩
儿童分类文案
最近玩过
全部游戏
设置入口
```

将：

```text
检查更新
整理图标
```

从 hero 主区域移走。

### 保留

- game order；
- recent；
- update flow；
- hash routing；
- dynamic import；
- navigationId。

### Commit

```text
feat: redesign game room home for kids
```

---

# 28. Sprint 7 — Meta Tree

前提：

> 女儿已经明显更愿意重复玩旗舰游戏。

如果没有：

不要做 Meta。

继续 polish 游戏。

如果有：

实现最小树成长。

### Commit

```text
feat: add gentle tree progression
```

---

# 29. 推荐的 Codex 工作方式

一次 Codex 会话只负责一个 Sprint。

不要给：

> 把整个 Experience 2.0 做完。

应该给：

> 完成 Sprint 2 停车场 Direct Manipulation。

原因：

- 更容易 review；
- 更容易测试；
- 更容易 revert；
- agent 不容易顺手重构 20 个游戏；
- context 更集中。

---

# 30. Codex 通用提示词

每个 Sprint 开头加入：

```text
先完整阅读仓库根目录 AGENTS.md。

本任务是小树游戏屋 Experience 2.0 的一个独立 Sprint。

必须遵守：
1. 不改变未明确要求修改的游戏规则。
2. 不修改线上服务器、不 deploy、不 push。
3. 不加入远程运行时依赖。
4. 不加入统计、广告、登录。
5. 不为了统一代码而重构无关游戏。
6. 优先复用现有 Phaser / TypeScript 能力，不增加 npm dependency。
7. 完成后运行 pnpm check 和 git diff --check。
8. 涉及交互时实际运行浏览器测试。
9. 按 AGENTS.md 要求提交 Git commit，但不要 push。
10. 最后报告：
   - 修改文件
   - 行为变化
   - 测试结果
   - commit hash
   - 未完成事项
```

然后追加当前 Sprint 的具体要求。

---

# 31. Sprint 2 可直接复制给 Codex 的任务

```text
任务：把停车场从“点汽车→点目标格”升级成单指直接拖动汽车。

目标文件：
- src/games/parking/scene.ts
- 必要时新增 src/experience/input/axis-drag.ts
- 必要时新增体验 primitive 的测试

不要改变：
- 停车场 core 规则
- BFS
- 关卡生成
- PAR
- undo 语义
- draft 格式
- 胜利条件

交互要求：

1. pointerdown
   - 按住汽车即进入拖动；
   - 汽车只允许沿自身朝向移动；
   - 车体立即有轻微 pickup 反馈。

2. pointermove
   - 显示对象连续跟随手指；
   - 使用 legalTargets() 推导合法移动范围；
   - 不允许穿车或越界；
   - 达到阻挡边界后停止；
   - pointermove 中不得调用 solve()、draw()、saveDraft()。

3. pointerup
   - 吸附到最近合法格；
   - 如果位置未发生变化则不增加步数；
   - 如果发生变化，调用现有 slide() 提交 core state；
   - history / undo / remember 保持正确。

4. 胜利
   - 红车到出口后保留现有胜利判定；
   - 红车加速驶出；
   - 之后再显示成功反馈。

5. 性能
   - 拖动期间不能销毁重建整张棋盘；
   - car view 应保持并只更新位置。

6. fallback
   - 如果保留原来的点选目标格方式，只能作为辅助路径；
   - 默认交互必须是拖车。

验收：
- 768×1024 Chrome 触控模拟；
- 1024×768；
- 实际完成一局；
- 实际 undo；
- 中途退出再继续；
- pnpm check；
- git diff --check；
- 不 push；
- 不 deploy。

完成后提交：

feat: make parking cars directly draggable
```

---

# 32. Sprint 4 可直接复制给 Codex 的任务

```text
任务：增强合成水果的 Game Feel，不修改核心规则。

主要目标：
1. 当前水果预览可通过单指左右拖动；
2. 松手投放；
3. 增加轻量落点提示；
4. merge 增加 squash → pop → settle；
5. merge 点显示短生命周期粒子和得分浮字；
6. 700ms 内连续 merge 显示纯表现型“连锁 ×N”，不能改变当前 core 计分；
7. 大水果碰撞/合并的声音和运动反馈比小水果更有重量；
8. danger line 进入危险状态时缓慢 pulse；
9. game over 保留最后水果堆作为背景，用 overlay 展示结果；
10. “再玩一次”为第一主操作。

必须保持：
- FRUIT_LEVELS；
- 半径；
- Matter 碰撞半径与显示半径一致；
- enableSleeping=false 相关约束；
- mergeFruits 规则；
- 最高分；
- game over 判定。

避免：
- 大量 camera shake；
- 高频报警音；
- 每个 merge new 一套不可回收粒子系统；
- 新 npm dependency。

完成后：
pnpm check
git diff --check
浏览器实际连续投放并触发多次连锁。

提交：
feat: deepen merge fruit feedback
```

---

# 33. Sprint 5 可直接复制给 Codex 的任务

```text
任务：把切水果升级为动作游戏 Experience 2.0 样板。

当前切割规则、炸弹规则、连续挥刀规则全部保持。

重点修改 scene / ActionScene 的表现流程：

1. Intro
   - 不再以三枚普通文字按钮作为整个视觉中心；
   - 切水果可以自定义 intro；
   - 主按钮为“开始”；
   - 难度是次级操作；
   - 首次可展示一次 ghost swipe 教学。

2. HUD
   - 分数和剩余时间拆成明显视觉元素；
   - 不使用长句 status 作为主要 HUD。

3. Round
   - 保留现有刀光、whoosh、半果、果汁、combo；
   - 不降低输入响应；
   - 连续挥刀判定规则不变。

4. Result
   - 时间到后冻结游戏；
   - 保留最后游戏画面；
   - 半透明背景；
   - 结果 panel overlay；
   - “再来一次”为主按钮；
   - “换难度”为次级按钮。

5. 架构
   - 如果需要扩展 ActionScene，优先新增可覆写 hook；
   - 不要迫使其他三个动作游戏同步大改；
   - 默认旧行为应继续兼容。

提交：
feat: polish fruit slicer round flow
```

---

# 34. Experience 2.0 Rollout

三个旗舰成功后，按问题类型扩散。

## Direct Manipulation

优先：

```text
水排序
七巧板
纸牌
停车场
```

---

## Snap / tactile feedback

优先：

```text
接水管
2048
数独
数织
叠叠消
```

---

## Action Flow

优先：

```text
点泡泡
红包雨
打地鼠
泡泡龙
```

---

## Content Pass

优先：

```text
七巧板
推箱子
数织
```

---

# 35. 不要做的事情

Experience 2.0 最容易失败的方式就是 scope explosion。

明确禁止第一阶段做：

- 新增第 24/25/26 个游戏；
- 全仓库 Scene 重写；
- 全局 ECS；
- Redux；
- React 重构 Phaser；
- 后端；
- 用户系统；
- 云存档；
- 数据统计 SDK；
- 排行榜；
- 商店；
- 金币经济；
- 成就系统大工程；
- 大规模素材重做；
- 新游戏引擎；
- 为“架构漂亮”重写已工作的 core。

---

# 36. 成功标准

Experience 2.0 成功，不是代码更多。

也不是动画更多。

真正指标是：

### 停车场

孩子第一次进入：

> 会直接尝试拖汽车。

而且拖得动。

---

### 合成水果

发生连续合并时：

> 会停下来盯着看。

---

### 切水果

一局结束：

> 会直接点“再来一次”。

---

### 大厅

打开应用：

> 不需要理解“分类”“检查更新”“整理图标”才能开始玩。

---

### 整个游戏屋

最关键的一句话：

> **“我还要玩一局。”**

---

# 37. 当前仓库相关文件

本方案基于以下当前代码：

```text
AGENTS.md
src/app/app.ts
src/app/library.ts
src/app/styles.css

src/games/puzzle-kit/scene.ts
src/games/action-kit/scene.ts

src/games/parking/scene.ts
src/games/parking/core/game.ts

src/games/merge-fruit/scene.ts

src/games/fruit-slicer/scene.ts

src/platform/audio/game-audio.ts
src/platform/display/header-button.ts
```

仓库：

https://github.com/callcter/games

---

# 38. 最终执行建议

不要同时启动多个 Experience Sprint。

第一条真正应该让 Codex 开始写代码的任务是：

> **Sprint 1：建立最小 Feedback / Axis Drag primitive。**

紧接着：

> **Sprint 2：让停车场真正可以拖车。**

这两步完成后先给孩子玩。

如果她不需要解释就开始拖车，并且明显比旧版本愿意多玩几局：

> 架构方向成立。

再继续合成水果和切水果。

如果没有明显改善：

> 不要继续抽象公共层。

回到停车场观察实际操作，再调输入与反馈。

这会比一次性给 20 多个游戏“统一加动画”有效得多。
---

# Part II — 长期执行规范（Codex / Agent 工作协议）

> 本部分把前面的产品与技术方案升级为可以长期执行的项目规范。
>
> **优先级关系：**仓库根目录 `AGENTS.md` > 当前工作树中的真实代码与测试 > 本文档。
> 如果本文档与当前代码发生漂移，Agent 必须先报告差异并以当前工作树为准更新本文档，不能为了“符合文档”而反向破坏已经正确的实现。

# 39. 文档控制（Document Control）

## 39.1 文档身份

```text
名称：小树游戏屋 Experience 2.0
建议仓库路径：docs/EXPERIENCE-2.md
状态：Active / Execution Spec
基线日期：2026-09-17
主要目标设备：iPad Safari
主要目标用户：8 岁儿童
主要实施工具：Codex / 人工 Review / 浏览器真实回归
```

## 39.2 文档不是静态 PRD

本文档同时承担：

```text
产品体验目标
+ 技术架构边界
+ Agent 执行规范
+ 游戏迁移台账
+ 验收标准
+ Playtest 决策记录
```

因此每完成一个 Sprint，必须同步更新：

1. 总任务看板；
2. 对应游戏迁移矩阵；
3. 已发现但未解决的问题；
4. 如产生新的长期约束，补入 DoD / 禁区；
5. 文档末尾 Changelog。

## 39.3 状态枚举

本文所有任务只使用下面这些状态：

| 状态 | 含义 |
| --- | --- |
| `BACKLOG` | 已确认需要做，但还没排入近期 Sprint |
| `READY` | 依赖满足，可立即开工 |
| `IN_PROGRESS` | 当前只允许一个主要 Agent Sprint 处于此状态 |
| `PLAYTEST` | 工程验收完成，等待真实孩子试玩 |
| `BLOCKED` | 有明确阻塞，必须写明原因 |
| `DONE` | 工程验收 + Playtest 决策均完成 |
| `WONT_DO` | 明确决定不做，并记录原因 |

禁止使用含糊状态：

```text
差不多
基本完成
应该好了
待优化
先这样
```

如果还存在已知验收项未通过，就不是 `DONE`。

---

# 40. 当前游戏清单与注册表漂移检查

Experience 2.0 按 **24 个游戏 ID**维护迁移矩阵：

```text
2048
gomoku
tetris
merge-fruit
freecell
klondike
spider
minesweeper
memory
tangram
pipes
sokoban
bubbles
pop-bubbles
red-rain
whack-mole
fruit-slicer
untangle
maze
nonogram
sudoku
water-sort
parking
tile-match
```

## 40.1 每次 Sprint 开始时必须重新核对

Agent 不得假定本文档中的列表永远正确。

必须读取：

```text
src/app/app.ts
src/app/puzzles.ts
src/app/library.ts
AGENTS.md
```

并建立当次工作树真实 inventory。

如果出现以下情况：

```text
游戏目录存在但未注册
app.ts 有游戏但 library.ts 无分类
AGENTS.md 有游戏但 app registry 没有
README 与实际路由不一致
```

必须：

1. 在 Sprint 报告中明确写出；
2. 不要顺手修复，除非与本 Sprint 直接相关；
3. 新建文档 TODO；
4. 如影响本 Sprint 的测试或路由，再做最小必要修正。

这条规则用于防止 Agent 因“顺手整理”扩大 scope。

---

# 41. Experience 2.0 总任务看板

> 初始状态仅表示执行规划。实际开始实施时，以当前工作树为准更新。

| ID | 工作项 | 状态 | 依赖 | 退出条件 |
| --- | --- | --- | --- | --- |
| E2-000 | 建立 Experience 2.0 baseline | `DONE` | 无 | 截图、行为记录、测试基线完成（2026-09-17，commit 2300f50，基线文档 docs/experience-2-baseline.md，192 测试） |
| E2-010 | 建立最小 motion primitive | `DONE` | E2-000 | press/pickup/snap/bump/pop 可复用（commit 0bc53b7） |
| E2-011 | 建立 floating text primitive | `DONE` | E2-000 | 不泄漏、不遮挡主交互（commit 0bc53b7，尚未接入游戏） |
| E2-012 | 建立轻量 particle primitive / pool | `DONE` | E2-000 | 生命周期、池化与上限明确（commit 0bc53b7，存活上限 80，尚未接入游戏） |
| E2-013 | 建立 axis drag primitive | `DONE` | E2-000 | clamp / nearest stop / shouldCommitStop 可测试（14 项纯计算单测） |
| E2-100 | 停车场直接拖车 | `PLAYTEST` | E2-013 | 单指拖车可完整通关（commit 8306049，工程验收见 Changelog，等待孩子试玩） |
| E2-101 | 停车场触觉式反馈 polish | `PLAYTEST` | E2-100 | pickup/snap/blocked/victory 成立（commit f1ce362，驶出尾迹+箭头+结果卡） |
| E2-102 | 停车场孩子 Playtest | `PLAYTEST` | E2-101 | 得到继续/调整/回退决策（等待真实试玩，按 §82 验收卡） |
| E2-200 | 合成水果跟手投放 | `DONE` | E2-010 | preview → release → drop 连贯（落点线+投影+投放初速，commit acd1c19） |
| E2-201 | 合成水果 merge feedback | `DONE` | E2-010~012 | merge/chain/重量感成立（涟漪/浮字/粒子/连锁/呼吸危险线，纯表现层不改计分） |
| E2-202 | 合成水果结果 overlay | `DONE` | E2-201 | 背景保留、Replay 主路径（压暗+底部弹卡+再玩一次主按钮） |
| E2-203 | 合成水果孩子 Playtest | `PLAYTEST` | E2-202 | 记录重复游玩行为（工程验收完成，按 §83 验收卡等待真实试玩） |
| E2-300 | 切水果 Intro/HUD | `DONE` | E2-000 | 不再依赖统一长句状态栏（玩具柜 intro+大数字 HUD，commit 8000a88） |
| E2-301 | 切水果 Result Overlay | `DONE` | E2-300 | 游戏最后一帧保留（压暗+底部弹卡） |
| E2-302 | ActionScene 可覆写 hooks | `DONE` | E2-301 | 旧游戏兼容（showHud/showResult 默认旧行为，点泡泡抽查通过） |
| E2-303 | 切水果孩子 Playtest | `PLAYTEST` | E2-301 | 一局后 Replay 路径验证（工程验收完成，按 §84 验收卡等待真实试玩） |
| E2-400 | Home 2.0 信息架构 | `DONE`（用户指令提前执行，Playtest 待补） | 三旗舰至少 2 个通过 Playtest | 儿童入口清晰（继续玩+儿童分类，commit 81a6a06） |
| E2-401 | 家长/管理功能降级 | `DONE` | E2-400 | 更新/整理不抢占首页（折叠进页脚家长设置） |
| E2-402 | Home 卡片反馈与进入转场 | `DONE` | E2-400 | 快、轻、不阻塞（scale 0.96 按压+图标下沉+阴影减弱） |
| E2-500 | 小树成长最小数据模型 | `DONE`（用户指令提前执行，Playtest 待补） | 旗舰重复游玩改善 | 本地、不可倒退、无 FOMO（family-game-room-tree-v1，commit 3c5eec3） |
| E2-501 | 小树成长 UI | `DONE` | E2-500 | 奖励是记录而非压力（hero 右上 SVG 小树+阶段徽章，无催促） |
| E2-600 | Water Sort 直接操作迁移 | `DONE` | Parking 经验稳定 | 倒水有拿起/倾斜/流动反馈（拿起弹起倾斜+非法摆动+成功 squash，commit d8e0bda） |
| E2-601 | Tangram 直接操作迁移 | `DONE` | motion 稳定 | 拖/转/吸附更像积木（拿起弹跳，commit d8e0bda） |
| E2-602 | Cards 拖牌体验升级 | `DONE` | drag 模式稳定 | 纸牌主路径可直接拖（纸牌/空当接龙/蜘蛛三款整组拖动+轻点回退点选，commit ee31a45） |
| E2-603 | Pipes 机械卡位反馈 | `BACKLOG` | motion 稳定 | 转管有明确 detent 感 |
| E2-604 | Sudoku 落笔反馈 | `BACKLOG` | motion 稳定 | 输入、冲突、完成层级清楚 |
| E2-605 | 2048 滑动手感升级 | `BACKLOG` | motion 稳定 | 方块移动/合并反馈连续 |
| E2-700 | 七巧板 Content Pass | `WONT_DO`（本轮） | 七巧板 feel 完成 | 20+ 轮廓需逐幅手工设计合法拼法，自动生成易产生不可拼图案；记入 Experience Debt |
| E2-701 | 推箱子 Content Pass | `DONE` | 推箱子 feel 检查 | 30 关（固定种子生成+BFS 验证，4-7/8-12/13-30 三段带，commit 06ff6c2） |
| E2-702 | 数织 Content Pass | `DONE` | 数织 feel 检查 | 50 幅（镜像/转置/反色双射变体保持唯一解，5×5 组 20 幅在前、10×10 组 30 幅在后，commit f352e7f） |
| E2-800 | 全库 Experience 回归 | `PLAYTEST` | 主要迁移完成 | 24 游戏可进入/退出/重玩（各 Wave 均经 CDP 抽查；全量矩阵待上线后真机回归） |
| E2-900 | Experience 2.0 稳定版 | `BACKLOG` | E2-800 | DoD + Playtest + PWA 回归通过 |

## 41.1 WIP Limit

强制规则：

```text
同时最多：
1 个 IN_PROGRESS 大型 Sprint
+ 1 个独立 bugfix
```

不要同时让多个 Agent 分别修改：

```text
PuzzleScene
ActionScene
GameAudio
Home
```

这些属于高冲突公共区域。

---

# 42. 迁移等级模型

每个游戏用 `L0 ~ L4` 描述 Experience 成熟度。

## L0 — Functional

```text
规则能玩
输入可用
结果正确
```

但主要仍是：

```text
点击按钮
刷新画面
显示文字
```

## L1 — Responsive

核心输入有即时反馈：

```text
press
highlight
move
sound
```

玩家知道“我的操作被接收了”。

## L2 — Tactile

对象具有玩具感：

```text
直接拖动
惯性/吸附
阻挡
回弹
重量
```

玩家操作对象，而不是操作命令。

## L3 — Expressive

游戏具有自己的表现语言：

```text
独特成功反馈
独特失败反馈
独特 HUD
独特结果流程
```

不再像换皮后的统一模板。

## L4 — Sticky

游戏具备自然重复游玩的理由：

```text
内容梯度
个人最好
轻量成长
快速 Replay
```

注意：

> L4 不是让游戏上瘾，也不是引入商业化留存机制。

它只是减少“玩一次就没东西了”。

---

# 43. 24 款游戏 Experience 迁移矩阵

> `当前等级` 已按 2026-09-17 Phase 1/2 实际完成情况核对更新（stabilization 同步）；仍以真实 Playtest 为最终校准。

| 游戏 | 类型 | 当前等级 | 目标 | 关键改造 | 优先级 | 主要风险 |
| --- | --- | ---: | ---: | --- | --- | --- |
| 停车场 | 空间解谜 | L2 | L3 | 轴向直拖、阻挡、吸附、红车驶出 | P0 | 拖动与 core 提交不同步 |
| 合成水果 | 物理合成 | L3 | L4 | 跟手预览、merge squash/pop、连锁表现、结果 overlay | P0 | Matter 状态与视觉 tween 冲突 |
| 切水果 | 动作 | L3 | L4 | Intro、HUD、Round start、结果 overlay、Replay | P0 | polish 影响输入延迟 |
| 水排序 | 排序解谜 | L2 | L3 | 拿起试管、倾斜、液体流动、非法倒水反馈 | P1 | 动画不能先于规则提交造成错觉 |
| 七巧板 | 空间拼图 | L2 | L3/L4 | pickup、旋转反馈、磁吸、完成轮廓；扩内容 | P1 | 多点触控/翻面手势复杂 |
| 空当接龙 | 纸牌 | L2 | L3 | 拖牌、合法落点、整列跟手、自动回收反馈 | P1 | 复杂合法移动与 drag preview |
| 纸牌 Klondike | 纸牌 | L2 | L3 | 拖牌/翻牌、吸附、自动收牌、结果 flow | P1 | 横屏密度和触控目标 |
| 蜘蛛纸牌 | 纸牌 | L2 | L3 | 成组拖动、落点反馈、收组动画 | P1 | 多牌组视觉层级 |
| 2048 | 数字滑块 | L2 | L3 | 预滑、统一移动 tween、merge pop、分数浮字 | P1 | 输入期间重复 swipe |
| 接水管 | 旋转解谜 | L1 | L3 | 转动卡位、连通水流、完成传播动画 | P1 | board redraw 与局部动画冲突 |
| 数独 | 数字逻辑 | L1 | L3 | 落笔、同行列高亮、错误/冲突、完成 sweep | P1 | 不要把错误提示做成惩罚 |
| 泡泡龙 | 瞄准消除 | L2 | L3/L4 | 发射 recoil、命中、消除、悬空掉落层级 | P1 | 粒子过多、瞄准线遮挡 |
| 叠叠消 | 槽位消除 | L1 | L3 | 拿起牌片、飞入槽位、三消 cascade、槽满反馈 | P1 | 动画与可点击层级同步 |
| 解绳结 | 空间拖拽 | L2 | L3 | pickup、拉扯感、交叉消失反馈、完成 flow | P2 | 拖点与线实时计算性能 |
| 迷宫探险 | 路径 | L1/L2 | L3 | 角色连续移动、路径痕迹、目标反馈 | P2 | 按住拖与离散格规则 |
| 记忆翻牌 | 记忆 | L2 | L3 | 翻牌 3D 感、配对 pop、回合反馈 | P2 | 动画锁输入时长 |
| 扫雷 | 逻辑 | L2 | L2/L3 | 翻格、插旗 tactile、连锁展开、踩雷层级 | P2 | 触控插旗手势冲突 |
| 数织 | 逻辑绘图 | L2（内容 L4） | L3/L4 | 连划 ink 感、完成行列、整图 reveal；50 幅内容已扩 | P2 | 连续输入撤销粒度 |
| 推箱子 | 格子解谜 | L1（内容 L4） | L3/L4 | 推箱位移、落点、错误推挤反馈；30 关内容已扩 | P2 | 保持步数/撤销精确 |
| 俄罗斯方块 | 动作/拼块 | L2 | L3 | 锁定、消行、等级变化、game-over flow | P2 | 不能增加视觉延迟影响节奏 |
| 点泡泡 | 动作 | L3 | L3 | 泡泡 burst、命中层级、combo、结束 overlay | P2 | 高频对象/声音上限 |
| 红包雨 | 动作 | L3 | L3 | 点击反馈、连击、炮仗错误反馈、结果 overlay | P2 | 奖励表现避免过度刺激 |
| 打地鼠 | 动作 | L3 | L3 | 洞口 anticipation、命中 squash、宝宝保护反馈 | P2 | 点击判定与动画状态 |
| 五子棋 | 棋类 | L2 | L3 | 落子触感、最后一步、连线、AI 思考反馈 | P2 | AI 等待不能显得卡死 |

## 43.1 迁移优先级解释

### P0

用来验证架构方向。

如果 P0 做完孩子体验没有明显改善：

> 停止向全库扩散。

### P1

体验收益大、已有共用 primitive 可明显降低成本。

### P2

本身已经较可玩，等待公共能力成熟后再迁移。

---

# 44. 全局 Definition of Done（DoD）

任何 Experience Sprint 标记 `DONE` 前，必须同时满足下面五类条件。

## 44.1 功能正确

- [ ] 游戏核心规则未发生非预期变化；
- [ ] 新交互不能产生非法 core state；
- [ ] undo / restart / resume 行为符合原有语义；
- [ ] win / lose 条件未因动画而提前或延后错误触发；
- [ ] 快速连续输入不会重复 commit；
- [ ] pointercancel 有合理回退；
- [ ] 离开游戏不会继续运行 timer / listener / Matter / Audio。

## 44.2 体验正确

- [ ] 核心输入后约 100ms 内出现可感知反馈；
- [ ] 玩家直接操作游戏对象，而不是不必要的二次确认；
- [ ] 核心动作至少具备两类反馈；
- [ ] 非法动作有解释性反馈，但不过度惩罚；
- [ ] 结果页明确提供 Replay；
- [ ] 不依赖 hover；
- [ ] 不要求儿童阅读长段说明才能开始。

## 44.3 iPad 触控

- [ ] 竖屏目标游戏在 768×1024 逻辑/模拟环境检查；
- [ ] 横屏目标游戏在 1024×768 检查；
- [ ] 反方向时仍可使用；
- [ ] 单指拖拽不会因为手指出界突然失控；
- [ ] 触控目标足够大；
- [ ] pointercancel / pointerup 在 window/capture 变化时安全；
- [ ] 不出现页面滚动、文本选择、长按菜单干扰核心操作。

## 44.4 工程质量

- [ ] `pnpm check` 通过；
- [ ] `git diff --check` 通过；
- [ ] 与 core 相关的纯计算新增 unit test；
- [ ] 与交互相关的关键路径至少做一次真实浏览器回归；
- [ ] 没有新增不必要 dependency；
- [ ] 没有修改生成物 `dist/`；
- [ ] 没有未解释的 `any` / 类型绕过；
- [ ] 没有长期存活的临时调试代码。

## 44.5 Scope

- [ ] diff 只包含当前 Sprint 必需文件；
- [ ] 无“顺手重构”无关游戏；
- [ ] 无未经任务要求的新规则；
- [ ] 无登录/广告/统计/远程运行时依赖；
- [ ] 无部署、push 或服务器变更；
- [ ] 文档台账已更新。

---

# 45. Experience 专项 DoD

## 45.1 Direct Manipulation DoD

适用于：停车场、水排序、七巧板、纸牌、解绳结等。

- [ ] pointerdown 后对象进入明确 pickup 状态；
- [ ] pointermove 只更新表现层，不高频写存档；
- [ ] pointermove 不运行昂贵 solver；
- [ ] 合法范围由 core / 纯逻辑推导；
- [ ] 松手只 commit 一次；
- [ ] 非法释放可回弹；
- [ ] cancel 后 state 与 display 一致；
- [ ] 快速拖动不会穿越阻挡；
- [ ] 对象不会因手指遮挡完全不可见；
- [ ] drag 后可立即进行下一个操作。

## 45.2 Animation DoD

- [ ] 动画只作用于变化对象；
- [ ] 不通过清空整场景制造简单 tween；
- [ ] tween 完成回调在 Scene 销毁后不会写死对象；
- [ ] 输入锁只覆盖必须的临界区；
- [ ] 可连续玩的动作不要每次锁 500ms+；
- [ ] 庆祝不会遮住“再来一次”；
- [ ] camera shake 轻微且稀有；
- [ ] 动画失败/被打断不会破坏 core state。

## 45.3 Audio DoD

- [ ] 高频动作有并发上限；
- [ ] 音效不会因连击叠成刺耳噪音；
- [ ] 不同层级结果可用音高/长度区分；
- [ ] 静音设置仍生效；
- [ ] AudioContext 生命周期遵守现有架构；
- [ ] 不加入远程音频依赖。

## 45.4 Result Flow DoD

- [ ] 最后一帧尽量保留；
- [ ] 明确告诉孩子发生了什么；
- [ ] 主按钮是“再来一次”或自然下一步；
- [ ] 返回游戏屋是次级但清晰路径；
- [ ] 不要求再次走冗长 setup；
- [ ] 新纪录/里程碑是附加反馈，不抢主任务。

---

# 46. Codex 变更边界

这是长期最重要的 Agent 约束之一。

## 46.1 Green Zone — 当前 Sprint 可以自由修改

前提：文件直接属于当前任务。

典型：

```text
src/games/<target-game>/scene.ts
src/games/<target-game>/index.ts
src/experience/**
tests/<target-game>/**
docs/EXPERIENCE-2.md
```

如果新建 Experience primitive：

```text
必须由当前 flagship 的真实需求驱动。
```

不允许为了未来想象出来的需求设计 30 个 API。

## 46.2 Yellow Zone — 修改前必须说明理由

```text
src/games/puzzle-kit/**
src/games/action-kit/**
src/platform/audio/**
src/platform/display/**
src/platform/storage/**
src/app/**
vite.config.ts
package.json
pnpm-lock.yaml
```

Agent 如果要改 Yellow Zone，必须在动手前内部确认：

```text
为什么目标游戏自身无法完成？
哪些现有游戏会被影响？
旧行为如何保持兼容？
需要补哪些回归？
```

在最终报告单独列：

```text
Shared Infrastructure Changes
```

## 46.3 Red Zone — 未经用户明确要求不得修改

```text
docs/ops.md 中的线上部署配置
nginx
DNS
证书
线上服务器
生产发布流程
GitHub secrets
PWA 安全边界
Phaser patch（除非任务就是该 patch）
已有 core 规则，仅为了做动画而重写
```

特别禁止：

> “为了方便拖动，我把停车场规则状态改成像素坐标。”

Experience 变化不能污染 core 模型。

---

# 47. Codex 禁区（Hard No）

任何 Sprint 中 Codex 都不得自行：

1. 新增广告、统计、analytics、tracking；
2. 增加账号、登录、云服务；
3. 引入远程字体、远程图片、远程音频；
4. 引入 SaaS 作为运行时依赖；
5. 为实现一个 tween 更换游戏引擎；
6. 把 Phaser 游戏迁移到 React/Canvas 自绘框架；
7. 引入 Redux/ECS 只为“统一状态”；
8. 重写已经有测试覆盖且与任务无关的 core；
9. 批量格式化整个仓库；
10. 批量重命名目录；
11. 修改 5 个以上无关游戏以适配一个新 abstraction；
12. 把所有游戏庆祝统一成同一个组件；
13. 让所有游戏共享同一个 HUD 视觉；
14. 把儿童首页变成 KPI/成就 dashboard；
15. 加连续签到；
16. 加限时领取；
17. 加虚拟货币经济；
18. 加随机宝箱；
19. 加体力；
20. 加“今天不玩就失去”的机制；
21. 自行 push；
22. 自行 deploy；
23. 自行修改线上服务器；
24. 因文档与代码不一致而删除代码以匹配文档。

---

# 48. Stop Conditions — Agent 必须停下并报告的情况

虽然 Agent 默认应尽可能完成任务，但遇到以下情况不能“猜一个方案继续大改”。

## 48.1 规则变化不可避免

例如：

```text
想实现拖拽，但现有 core 无法表达需要的合法目标。
```

Agent 应先寻找：

```text
scene adapter
pure helper
view-only range calculation
```

如果仍必须改规则层：

> 把原因写清楚，并将 core 改动控制到最小。

## 48.2 需要公共层大破坏式 API

如果一个 flagship polish 需要让：

```text
10+ 游戏同步修改才能编译
```

说明 abstraction 设计过头。

默认撤回并选择兼容式 API。

## 48.3 测试与真实行为矛盾

不能为了绿测试而让用户体验变坏。

必须识别：

```text
测试过期
还是实现错误
```

并报告。

## 48.4 iPad 特定问题无法在桌面复现

不要根据 Chrome 猜 Safari 行为。

保留最小修复，记录：

```text
Needs real iPad verification
```

进入 `PLAYTEST/BLOCKED`，而不是宣称完成。

---

# 49. Sprint 进入条件（Definition of Ready）

一个 Sprint 只有满足以下条件才能从 `BACKLOG` 进入 `READY`：

- [ ] 目标游戏明确；
- [ ] 用户体验问题可用一句话表达；
- [ ] 主要交互路径明确；
- [ ] 不改变哪些规则已经写清楚；
- [ ] 目标文件已确认；
- [ ] baseline 可运行；
- [ ] 已知测试命令可用；
- [ ] 验收步骤能在本地执行；
- [ ] 没有依赖另一个尚未完成的大重构。

示例：

```text
错误：
“优化停车场体验。”

正确：
“默认操作从点车→点目标，改为单指轴向拖动；
保持 slide/BFS/PAR/undo/draft 不变。”
```

---

# 50. Sprint 输出协议

每个 Codex Sprint 最终必须按固定格式报告。

```markdown
## Summary
一句话说明用户能感知到的变化。

## Changed Files
- file A — 为什么改
- file B — 为什么改

## Behavior Before
旧交互是什么。

## Behavior After
新交互是什么。

## Core Rule Impact
- none
或
- 精确列出规则变化

## Shared Infrastructure Changes
- none
或
- API / 兼容影响

## Verification
- pnpm check: PASS/FAIL
- git diff --check: PASS/FAIL
- browser regression: PASS/FAIL
- portrait: PASS/FAIL/NA
- landscape: PASS/FAIL/NA

## Manual Test Performed
按真实用户路径逐步描述。

## Known Issues
没有就写 none。

## Playtest Needed
孩子需要重点观察什么。

## Commit
<hash> <message>
```

禁止只报告：

> “完成了，测试通过。”

---

# 51. Git / Commit 规范

## 51.1 一个 Sprint 可以多个 commit

推荐：

```text
refactor: add axis drag primitive
feat: make parking cars directly draggable
feat: polish parking blocked feedback
```

不要为了追求“一个 commit”把所有工作塞成大 diff。

## 51.2 Commit 必须可解释

好的：

```text
feat: make parking cars directly draggable
```

不好的：

```text
update code
fix stuff
experience improvements
```

## 51.3 不 Push

Agent 默认：

```text
commit allowed
push forbidden
```

除非用户当次明确要求 push。

---

# 52. 回归矩阵

每个涉及公共层的 Sprint 至少抽查下面组合。

| 类别 | 游戏 | 原因 |
| --- | --- | --- |
| 旗舰益智 | 停车场 | Direct Manipulation |
| 旗舰物理 | 合成水果 | Matter / 竖屏 |
| 旗舰动作 | 切水果 | 高频 pointer / timer |
| 典型 PuzzleScene | 数独 | 公共 puzzle UI |
| 拖拽 puzzle | 七巧板 | pointer / snap |
| 动作模板 | 点泡泡 | ActionScene 兼容 |
| 横屏纸牌 | 空当接龙 | 1024×768 / drag |
| 独立老游戏 | 2048 | 非 puzzle-kit 回归 |
| 大厅 | Home | route / recent / order / update |

不是每个 Sprint 都必须完整玩完九个游戏。

规则：

### 只改游戏自身 scene

```text
目标游戏完整回归
+ Home 进入/退出
```

### 改 puzzle-kit

```text
目标游戏
+ 数独
+ 七巧板
+ 至少 1 个其他 puzzle
```

### 改 action-kit

```text
切水果
+ 点泡泡
+ 打地鼠或红包雨
```

### 改 platform audio/display

```text
至少 1 个 puzzle
+ 1 个 action
+ 1 个独立游戏
```

### 改 app.ts / routing

```text
Home
+ 至少进入/退出 5 种不同注册方式的游戏
```

---

# 53. 浏览器与设备验收矩阵

## 53.1 开发阶段

至少：

```text
macOS Chrome
鼠标
触摸模拟
```

## 53.2 Flagship 进入 PLAYTEST 前

至少验证：

| 场景 | 期望 |
| --- | --- |
| 768×1024 portrait | 无遮挡、主操作舒适 |
| 1024×768 landscape | 反方向仍可用 |
| 快速连续 pointerdown/up | 不重复 commit |
| 拖出 canvas 再回来 | 不出现 stuck dragging |
| pointercancel | 回到稳定状态 |
| Home → Game → Home ×5 | 无残留 audio/timer/listener |
| Reload + resume | 存档仍能恢复 |
| 静音 | 新增音效全部静音 |

## 53.3 真 iPad

P0/P1 游戏在标记 `DONE` 前应尽量进行真实 iPad 检查。

重点：

```text
touch-action
Safari pointer capture
系统长按
Home Screen PWA
方向切换
音频 unlock
高 DPR
```

桌面模拟不能完全替代这一步。

---

# 54. 性能预算

Experience 2.0 不接受“更好看但明显更卡”。

## 54.1 输入路径

`pointermove` 中禁止：

```text
BFS / solver
全场景重建
IndexedDB 写入
大 JSON stringify
纹理生成
大量 text create/destroy
```

## 54.2 对象数量

粒子必须有硬上限。

建议初始预算：

```text
普通反馈：≤ 12 粒子
大反馈：≤ 30 粒子
同时活跃的短粒子：尽量 < 80
```

具体数字可根据设备实测调整。

## 54.3 高频音频

同类瞬态声音应限流：

```text
pop / click / collide
```

不要 10 个对象同一帧触发 10 个满音量声源。

## 54.4 存档

```text
dragging / pointermove：0 次写盘
commit：必要时 debounce / 现有 remember 机制
exit：flush
```

---

# 55. 可访问性与儿童友好约束

虽然主要用户是一个具体孩子，但仍要保留好的通用设计。

## 55.1 不只靠颜色

已有水排序的颜色 + 符号思路继续保留。

状态尽量使用：

```text
颜色 + 形状
颜色 + 图标
颜色 + 动作
```

## 55.2 文字

规则说明：

```text
优先 1 句
最多 2 句
```

能用动作教学就不要长段说明。

## 55.3 错误反馈

不要：

```text
红色全屏
刺耳 buzzer
“错误！”
巨大 X
```

优先：

```text
轻微 bump
柔和音效
对象回到合法位置
```

让孩子理解“这个动作走不通”，而不是“你做错了”。

## 55.4 失败

失败页文案避免羞辱或排名压力。

可用：

```text
再试一次
差一点点
这次得了 XX 分
```

不要：

```text
太差了
失败！
你输了
排名下降
```

（规则本身需要表达输赢的棋类除外，但仍保持中性。）

---

# 56. Playtest Harness 详细规范

## 56.1 第一版优先人工观察

不要为了采集数据先做半个月 telemetry。

使用一份简单本地记录：

```markdown
# Playtest — parking — YYYY-MM-DD

## Setup
版本/commit：
设备：
是否第一次玩此版本：

## Observation
- 进入到第一次操作：__ 秒
- 是否自行拖车：是/否
- 卡住超过 3 秒次数：__
- 请求帮助次数：__
- Undo 次数：__
- Restart 次数：__
- 完成一局：是/否
- 主动 Replay：__ 次
- 主动退出时间：__

## Verbatim
只记录孩子主动说的话，不诱导。

## Parent Notes
哪里明显困惑：
哪里笑了：
哪里显得无聊：

## Decision
KEEP / TUNE / ROLLBACK / EXPERIMENT
```

## 56.2 不要边玩边教

测试时禁止：

```text
“你拖这个”
“点右边”
“你看那里”
```

否则无法判断 UI 是否自解释。

## 56.3 可以回答什么

如果孩子主动问：

> “怎么玩？”

第一次记录问题发生。

然后可以给最小提示，避免让测试变成挫败体验。

---

# 57. Playtest 决策门

每个 P0 flagship 完成工程实现后，不直接扩散。

进入：

```text
PLAYTEST
```

然后四选一。

## KEEP

明显改善，无重大困惑。

→ 可以提取/稳定公共能力。

## TUNE

方向正确，但手感参数不佳。

例如：

```text
snap 太慢
pickup 太夸张
拖动边界太硬
```

→ 小范围调整，不重构。

## ROLLBACK

新交互反而更困惑。

→ 回到旧路径或混合模式。

不要因为已经写了很多代码而坚持。

## EXPERIMENT

孩子行为与预期不同但有趣。

→ 做一个很小 A/B 变体，人工观察，不做线上实验系统。

---

# 58. “再来一次”指标

这个项目不需要商业 KPI。

内部只维护几个体验信号：

```text
TTFI  = Time To First Interaction
HELP  = 一局主动求助次数
STUCK = >3 秒无进展/反复误点
RETRY = 自主 Replay 次数
EXIT  = 自主退出时点
```

最有价值的是：

```text
RETRY
```

但不要为了提高 RETRY 引入：

```text
FOMO
奖励压力
随机奖励
```

目标是：

> 游戏本身值得再玩。

---

# 59. 参数调优规则

Experience 数值必须集中，不要散落 magic numbers。

例如：

```ts
const PARKING_FEEL = {
  pickupScale: 1.035,
  pickupMs: 100,
  snapMs: 180,
  blockedOvershoot: 8,
  blockedMs: 140,
} as const
```

好处：

孩子 Playtest 后可以快速调整。

不要在：

```text
pointerdown
pointermove
pointerup
victory
```

四处各写一个 `180`。

## 59.1 参数优先于架构

如果 Playtest 反馈“拖起来怪”：

第一反应应该调：

```text
pickup scale
finger offset
snap duration
blocked elasticity
```

不是立刻重写 drag framework。

---

# 60. Common Experience Primitives 的 API 纪律

Experience 公共层遵守“三次规则”。

## 第一次

写在旗舰游戏里也可以。

## 第二次

识别相似性，但可以只提取小 helper。

## 第三次

行为已经稳定，再升级为公共 abstraction。

例外：

`axis drag clamp / nearest stop` 这种明显纯逻辑、且停车场第一天就需要单测的 primitive，可以早提取。

禁止：

> 先设计一个万能 `GameFeelManager`，然后逼所有游戏适配它。

---

# 61. 共享能力目标形态

最终可能形成：

```text
src/experience/
├── input/
│   ├── drag-session.ts
│   ├── axis-drag.ts
│   └── pointer-utils.ts
│
├── motion/
│   ├── press.ts
│   ├── pickup.ts
│   ├── snap.ts
│   ├── bump.ts
│   └── pop.ts
│
├── fx/
│   ├── particles.ts
│   ├── floating-text.ts
│   └── rings.ts
│
├── flow/
│   ├── result-overlay.ts
│   └── replay.ts
│
└── tutorial/
    └── gesture-coach.ts
```

但这只是方向。

**不要求 Sprint 1 就创建所有目录。**

只创建当前任务真正需要的文件。

---

# 62. Game-Specific Identity Checklist

每个迁移到 L3 的游戏，必须回答五个问题。

```text
1. 这个游戏最主要的“玩具对象”是什么？
2. 手指如何直接操纵它？
3. 合法动作是什么声音/运动？
4. 非法动作是什么声音/运动？
5. 成功时什么表现只有这个游戏才合理？
```

例：停车场

```text
玩具对象：汽车
直接操作：沿车头轴向拖
合法：轮胎/卡位 click + snap
非法：撞到阻挡 + 轻微 bumper
成功：红车驶出出口
```

例：数独

```text
玩具对象：数字格
直接操作：选格 + 落笔
合法：像铅笔落下一样 pop
冲突：相关格轻亮/轻震
成功：行列/宫依次 sweep
```

如果一个游戏的答案变成：

```text
“播放统一星星粒子”
```

说明又开始过度统一表现。

---

# 63. 首页 Home 2.0 的信息架构 DoD

Home 2.0 完成必须满足：

- [ ] 打开后 1 个屏幕内能直接开始游戏；
- [ ] “继续玩”只在有最近记录时出现；
- [ ] 分类名称使用儿童语言；
- [ ] 最近玩过不超过 4 个；
- [ ] 全部游戏仍可访问；
- [ ] 用户自定义排序数据不丢失；
- [ ] PWA update 仍可完成；
- [ ] “检查更新”不再作为儿童主路径；
- [ ] “整理图标”不与开始游戏竞争视觉层级；
- [ ] loadProgress 异步回填不会污染已导航页面；
- [ ] hash/history/back 行为不倒退；
- [ ] icon async replacement 仍安全；
- [ ] Home 不变成复杂的成长 dashboard。

---

# 64. Meta Tree DoD

只有满足以下前置条件才能做：

```text
至少两个旗舰游戏 Playtest = KEEP
并且自主 Replay 较旧版明显改善
```

Meta Tree 必须：

- [ ] 完全本地；
- [ ] 可以离线；
- [ ] 永久累积，不倒退；
- [ ] 无连续签到；
- [ ] 无每日任务；
- [ ] 无倒计时奖励；
- [ ] 无随机付费式奖励结构；
- [ ] 无虚拟货币压力；
- [ ] 不阻止直接进入游戏；
- [ ] 不为了“领取奖励”要求孩子多点几层 UI。

目标：

> 游戏经历留下痕迹。

不是：

> 用 Meta 强迫孩子回来。

---

# 65. Content Pass 规范

增加关卡不能只是增加数量。

每个新增内容集必须有：

```text
学习阶段
熟练阶段
变化阶段
挑战阶段
```

## 65.1 每一阶段应引入什么

### 学习

单一概念。

### 熟练

重复概念但布局变化。

### 变化

加入第二个概念或反直觉局面。

### 挑战

组合已学能力，不靠突然加速或缩小触控目标增加难度。

## 65.2 儿童难度原则

不要通过：

```text
字更小
按钮更小
时间突然极短
随机惩罚
```

制造“挑战”。

挑战应来自规则本身。

---

# 66. Bug 优先级

Experience 2.0 中发现 bug 按以下等级处理。

## P0 — Stop Ship

```text
丢存档
规则产生非法状态
无法退出
持续音频/计时器泄漏
PWA 无法打开
孩子可能误触进入外部网络/不安全行为
```

立即停止 polish。

## P1 — 当前 Sprint 必须解决

```text
拖动卡死
pointerup 丢失
明显错位
胜利后不能 Replay
动画导致重复计分
```

## P2 — 可以记录后续修复

```text
某个非主路径动画略生硬
小尺寸文案间距
轻微粒子层级问题
```

## P3 — Polish Wish

```text
换一个 easing 可能更好
粒子形状可以更漂亮
```

不要让 P3 阻塞交付。

---

# 67. Experience Regression Bug 模板

```markdown
## Game
parking

## Commit
<hash>

## Environment
- iPad / Chrome / Safari
- portrait / landscape

## Steps
1.
2.
3.

## Expected

## Actual

## Is Core State Wrong?
yes / no / unknown

## Is It Reproducible?
always / intermittent

## Severity
P0 / P1 / P2 / P3

## Suspected Layer
core / scene / experience primitive / platform / app
```

这样 Agent 不会把所有体验 bug 都当规则 bug 修。

---

# 68. 公共层变更的兼容策略

## 68.1 新 API 优于破坏旧 API

例如 ActionScene：

优先：

```ts
protected showResult(...): void {
  // default legacy implementation
}
```

允许切水果覆写。

不要直接把：

```text
所有 action game
```

一次迁移。

## 68.2 Deprecated 只能短期存在

如果 Experience 2.0 最终证明新 flow 更好：

```text
先迁移
再删旧 API
```

删除旧 API 必须作为独立 cleanup Sprint。

不要与新功能混在同一个大 commit。

---

# 69. Scene 生命周期专项检查

每次新增：

```text
window listener
pointer listener
setTimeout
Phaser timer
Tween callback
Matter listener
Audio source
```

都要回答：

```text
Scene SHUTDOWN 怎么清？
Game DESTROY 怎么清？
多次 cleanup 是否安全？
```

特别警惕：

```ts
window.addEventListener('pointermove', ...)
```

如果 pointerup 没收到，必须仍有销毁清理。

---

# 70. 存档与动画的单一真相原则

永远：

```text
core state = 真相
view = core 的表现
```

Direct Manipulation 中允许短暂 view state：

```text
drag preview
hover / pickup
rubber-band overshoot
```

但这些不能直接写进 draft。

正确流程：

```text
pointerdown
↓
view preview
↓
pointermove
↓
view preview
↓
pointerup
↓
core action
↓
成功：commit + remember
失败：view restore
```

---

# 71. 动画中断策略

孩子会做成人测试员很少做的事：

```text
疯狂连点
同时两根手指
拖一半退出
旋转屏幕
动画没完又点
```

因此每个关键动画必须属于下面一种：

## Visual-only

可以安全被取消。

例如：

```text
粒子
浮字
轻微 pop
```

## Commit transition

必须避免重复提交。

例如：

```text
停车场 snap 后写 state
水排序倒水动画
```

需要明确：

```text
state 何时 commit
何时解锁输入
取消时如何恢复
```

## Terminal

游戏已经结束。

例如：

```text
红车驶出
时间到结果页
```

只能触发一次。

---

# 72. 多点触控策略

默认：

> 一次核心操作只认一个 active pointer。

除非某游戏明确需要双指。

例如停车场：

```text
pointer A 拖车
pointer B down
→ 忽略 B
```

避免两个手指同时提交两辆车。

七巧板未来如果需要双指旋转，应作为独立设计，不要让通用 drag 默认支持。

---

# 73. 教学系统规范

教程优先级：

```text
游戏本身可理解
↓
animated hint
↓
一句话
↓
详细说明
```

不要一进入就弹模态教程。

## 73.1 Ghost Gesture

适合：

```text
切水果 swipe
停车场 drag
水排序 pour
```

规则：

- 首次或明显停滞时显示；
- 一旦用户真实输入立即消失；
- 不挡住目标；
- 不重复骚扰；
- 不要求“下一步”。

---

# 74. “帮助”按钮策略

当前很多游戏都有“怎么玩 / 提示规则”。

Experience 2.0 不需要全部删除。

但优先顺序改为：

```text
自解释交互
> 情境提示
> 帮助按钮
```

帮助内容只解释当前关键规则。

不要写说明书。

---

# 75. Visual Consistency vs Game Identity

全库仍需一致的是：

```text
字号可读性
触控尺寸
返回方式
静音位置/能力
安全边距
色弱考虑
结果页基本信息层级
```

不应该一致的是：

```text
所有背景颜色
所有按钮形状
所有胜利动画
所有粒子
所有 HUD
所有音效组合
```

这就是：

> **系统一致，游戏不同。**

---

# 76. 设计 Token 的边界

可以建立少量 token：

```ts
export const EXPERIENCE_TIMING = {
  instant: 80,
  quick: 160,
  normal: 240,
} as const
```

但不应建立：

```text
全游戏统一 successColor
全游戏统一 successParticle
全游戏统一 victoryDuration
```

具体游戏可以偏离 token。

Token 是默认值，不是审美牢笼。

---

# 77. Home / Game 转场性能原则

打开游戏时：

```text
先响应点击
↓
快速视觉反馈
↓
动态 import
↓
挂载游戏
```

不要为了 fancy transition：

```text
等 800ms 动画播完
才开始 import
```

可以让 import 与轻转场并行。

目标：

> 点击以后立刻感觉“进去了”。

---

# 78. 更新与 PWA 的儿童化原则

更新属于平台能力，不属于游戏任务。

首页不应把：

```text
检查更新
```

放成与游戏同等级 CTA。

但必须保持：

```text
有更新 → 非阻塞提示
用户确认 → 更新
更新后 → 清晰确认
```

不要自动强制刷新正在玩的局。

---

# 79. 里程碑定义

## Milestone A — Feel Proof

包含：

```text
停车场
合成水果
切水果
```

退出条件：

- 三个旗舰工程 DoD 通过；
- 至少两个真实 Playtest = KEEP；
- 公共 primitive 未产生明显过度设计；
- 未破坏 core 与 PWA。

## Milestone B — Game Room

包含：

```text
Home 2.0
家长管理降级
继续玩
儿童分类
```

退出条件：

> 孩子不需要理解系统功能就能开始玩。

## Milestone C — Library Migration

P1 游戏迁移。

退出条件：

```text
至少 80% 高频游戏达到 L3
```

## Milestone D — Depth

包含：

```text
内容扩展
小树成长（仅条件满足时）
全库回归
```

---

# 80. Release Gate — Experience 2.0 稳定版

发布稳定版前：

## App

- [ ] Home 无阻塞问题；
- [ ] PWA 更新可用；
- [ ] 离线可进入已缓存游戏；
- [ ] Recent/order/progress 不丢；
- [ ] back/exit 行为正确。

## Flagships

- [ ] Parking Playtest = KEEP；
- [ ] Merge Fruit Playtest = KEEP 或 TUNE 后通过；
- [ ] Fruit Slicer Playtest = KEEP 或 TUNE 后通过。

## Shared

- [ ] PuzzleScene 兼容；
- [ ] ActionScene 兼容；
- [ ] Audio cleanup；
- [ ] High DPI；
- [ ] pointer cleanup。

## Quality

- [ ] `pnpm check`；
- [ ] `git diff --check`；
- [ ] browser regression；
- [ ] 真 iPad flagship smoke test；
- [ ] 文档状态同步。

---

# 81. Codex Sprint Prompt 模板（最终版）

以后每个 Experience Sprint 建议从下面模板复制。

```text
先完整阅读：
1. 仓库根目录 AGENTS.md
2. docs/EXPERIENCE-2.md
3. 当前任务涉及的 core / scene / tests

本任务是 Experience 2.0 的一个独立 Sprint。

【Sprint ID】
E2-XXX

【用户可感知目标】
用一句话描述孩子玩的时候会有什么不同。

【目标文件】
列出预计修改文件。

【规则冻结】
明确哪些 core 规则、计分、存档、undo、生成算法不得改变。

【交互要求】
逐条列出 pointerdown / move / up / cancel / win / replay。

【体验要求】
列出 motion / sound / particles / result flow。

【性能要求】
明确 pointermove 禁止做什么。

【兼容要求】
如果修改共享层，列出旧游戏兼容要求。

【验收】
- pnpm check
- git diff --check
- 指定浏览器尺寸
- 指定手工路径
- 如涉及公共层，按 EXPERIENCE-2 回归矩阵抽查

【禁止】
- 不新增无关依赖
- 不重构无关游戏
- 不 deploy
- 不 push
- 不改线上服务器
- 不加入 tracking/ads/login/remote runtime assets

【提交】
指定 commit message。

完成后严格按 docs/EXPERIENCE-2.md 的 Sprint 输出协议报告。
```

---

# 82. Parking Playtest 验收卡

工程通过之后，不看代码，直接用这张卡。

```text
[ ] 孩子第一次看到汽车会主动按/拖
[ ] 不解释也知道汽车只能沿一个方向移动
[ ] 撞到车时能理解“被挡住”
[ ] 松手汽车不会停在半格
[ ] 可以一次拖过多个空格
[ ] 不会误以为绿色目标格才是可点击对象
[ ] Undo 能理解
[ ] 红车出去时会注意到成功反馈
[ ] 结束后能快速再来一局
```

关键观察：

> 她是否还会像旧版那样“点车以后寻找第二个可点击目标”。

如果会：

旧 affordance 残留太强。

---

# 83. Merge Fruit Playtest 验收卡

```text
[ ] 会自然拖动顶部预览水果
[ ] 知道松手就是投放
[ ] 不会因为 guide 误以为必须精确对线
[ ] 普通合并明显可感知
[ ] 连续合并比普通合并明显更兴奋，但不刺眼
[ ] 大水果看起来/听起来更重
[ ] 危险线能被注意到但不制造焦虑
[ ] game over 后马上知道怎么再玩
[ ] 至少出现一次自主 Replay
```

---

# 84. Fruit Slicer Playtest 验收卡

```text
[ ] 不需要读玩法说明就会划
[ ] 开局等待不觉得长
[ ] HUD 能快速看到分数/时间
[ ] combo 不遮挡下一批水果
[ ] 炸弹反馈明确
[ ] 时间到时理解一局结束
[ ] 结果页保留刚才那局的连续感
[ ] “再来一次”无需寻找
```

---

# 85. 全库迁移的推荐波次

## Wave 0 — Proof

```text
parking
merge-fruit
fruit-slicer
```

## Wave 1 — Direct Manipulation

```text
water-sort
tangram
freecell
klondike
spider
untangle
```

## Wave 2 — Tactile Puzzle

```text
2048
pipes
sudoku
tile-match
memory
maze
minesweeper
```

## Wave 3 — Action Flow

```text
bubbles
pop-bubbles
red-rain
whack-mole
tetris
```

## Wave 4 — Depth / Content

```text
sokoban
nonogram
tangram
```

## Wave 5 — Remaining Identity Pass

```text
gomoku
其他尚未达到 L3 的游戏
```

每个 Wave 结束都做一次：

```text
Do we still like this abstraction?
```

如果答案是否定的，允许重构 Experience 层。

不要因为已经迁移 5 个游戏就拒绝修正方向。

---

# 86. 架构 ADR 建议

Experience 2.0 中出现真正长期的架构决定时，建议放：

```text
docs/adr/
```

例如：

```text
0001-view-state-never-persists.md
0002-action-scene-hooks.md
0003-experience-primitives-not-skins.md
```

ADR 只记录“未来 Agent 很可能再次争论”的问题。

不要为每个 tween 写 ADR。

---

# 87. Agent 审查清单

让第二个 Agent review Experience PR 时，不要只让它找 bug。

使用：

```text
1. 有没有改变规则？
2. 有没有在 pointermove 做昂贵工作？
3. 有没有整盘 redraw 本可局部更新？
4. 有没有生命周期泄漏？
5. 有没有抽象过度？
6. 有没有让不同游戏反而更像？
7. 有没有把 Replay 路径变长？
8. 有没有依赖 hover / 小目标？
9. 有没有让错误反馈过度刺激？
10. 有没有新外部依赖？
11. 有没有测试只覆盖规则、不覆盖交互风险？
12. 这个改动孩子是否真的能感知？
```

最后一个问题尤其重要。

如果答案是：

> “孩子基本感知不到。”

那很可能不值得做这个 Experience Sprint。

---

# 88. “不要为了统一而统一”的代码审查示例

如果 Agent 提交：

```ts
this.feedback.success()
```

review 时必须追问：

> success 到底发生了什么？

如果它内部固定：

```text
绿色闪光
星星粒子
win sound
```

不接受。

更好的公共 API：

```ts
motion.pop(target)
particles.burst(position, options)
floatingText.show(...)
```

然后游戏组合：

```ts
parkingVictory()
sudokuVictory()
waterSortVictory()
```

可以是游戏私有函数。

代码重复少量表现逻辑，优于所有游戏失去身份。

---

# 89. Experience Debt 台账

新增体验 hack 如果暂时无法优雅处理，必须记录：

| ID | 游戏 | Debt | 原因 | 何时处理 |
| --- | --- | --- | --- | --- |
| XD-001 | - | - | - | - |

只有满足以下条件才记 debt：

```text
已知问题
当前不影响主要体验
现在处理会显著扩大 scope
```

禁止把 P0/P1 bug 叫作 debt 来推迟。

---

# 90. 文档同步规则

每次完成 Experience Sprint：

### 必改

```text
总任务看板状态
对应游戏当前等级
Changelog
```

### 条件改

```text
新公共 API → 架构章节
新长期限制 → DoD / 禁区
新 Playtest 发现 → Playtest Notes
```

文档变更与代码放在同一个 Sprint commit 或紧邻的 docs commit。

---

# 91. Playtest Notes 区

> 后续只记录结论，不在主文档堆完整录像式流水账。

## Template

```markdown
### YYYY-MM-DD — <game> — <commit>

Decision: KEEP / TUNE / ROLLBACK / EXPERIMENT

Observed:
- ...
- ...

Changed next:
- ...

Do not change:
- ...
```

---

# 92. Experience 2.0 Changelog

## 2026-09-17 — v0.6（Phase 1/2 Stabilization）

只修回归、不扩功能（docs/EXPERIENCE-2-PHASE-1-2-STABILIZATION.md）：

- Nonogram progress fix：大厅摘要总数从写死 9 改为引用 PATTERNS.length 唯一来源（当前 50），「已画 X / N 幅」恒与实际内容一致；
- Sokoban progress fix：大厅「已过 X 关」上限从写死 10 改为引用 LEVELS.length（当前 30），第 11 关及以后计入，越界/损坏旧 key 仍被过滤；
- FreeCell foundation drag fix：Foundation 顶牌不再注册为拖动源（规则不支持取回，拖了必然弹回是错误 affordance），其余五种拖动路径与 undo/自动收牌/胜利流程不变；
- 文档状态同步：Task Board E2-203/303 置 PLAYTEST；Migration Matrix 按 L0~L4 定义逐项核对更新（停车场 L2、纸牌三款 L2、切水果/合成水果 L3 等）；Changelog 追加本条。
- 测试：新增 progress 纯逻辑测试 2 项（推箱子 5 关含 L10+/L29 与非法 key 过滤、数织 0/1/17/全量四档总数），全库 215 项全绿；CDP 实测大厅「已画 17 / 50 幅」「已过 5 关」、FreeCell 列→列/tableau→freecell/freecell→tableau/undo/foundation 不可拖。

## 2026-09-17 — v0.5（Wave 1~5 全库迁移完成，第二阶段落地）

用户指令「继续完成下一阶段，一次性完成，分批提交」——五个 Wave 全部落地，每个 Wave 独立提交与 CDP 抽查验收。

- Wave 1a 纸牌拖牌（ee31a45）：纸牌/空当接龙/蜘蛛主操作升级为整组拖动跟手、落点判定提交、轻点退回点选；规则/计分/存档/自动收尾不动。
- Wave 1b 触觉拿起（d8e0bda）：水排序拿起弹起倾斜、非法倒水摆动、成功 squash；七巧板拿起弹跳。
- Wave 2 触觉反馈（37e3e34）：2048 合并 +分浮字、记忆配对弹跳+高音、扫雷踩雷轻震/胜利暖光。迷宫轨迹与叠叠消飞入此前已具备。
- Wave 3 动作结算（b01f4c1）：点泡泡/红包雨/打地鼠接入 showKeptResult（保留游戏世界+底部弹卡+各自强调色）；泡泡龙发射口扩散环；俄罗斯方块消行闪光此前已有。
- Wave 4 内容扩展：数织 9→50 幅（f352e7f，双射变体严格保持唯一解，全部经求解器验证）；推箱子 10→30 关（06ff6c2，固定种子生成+BFS 验证+PAR 回填，测试逐一校验）。
- Wave 5 五子棋（91537a4）：胜利连线 340ms 生长动画；落子弹跳/最后一步标记/思考提示此前已有。
- 测试基线 212→213（38 文件）。
- Experience Debt（§89）：XD-001 接水管完成传播 sweep（draw 全量重建无 view 引用，需重构绘制层）；XD-002 数独落笔弹跳（复用棋盘对象无独立 view）；XD-003 七巧板内容扩展（E2-700 WONT_DO，需手工拼法设计）。

## 2026-09-17 — v0.4（Sprint 3~7 落地，第一阶段完成）

用户指令「继续推进，全部完成，分批提交」——Sprint 3~7 一次性落地，每个 Sprint 独立提交与验收。
Home 2.0 与 Meta Tree 按方案本应等待旗舰 Playtest=KEEP 后启动，本次按用户明确指令提前执行（§28 前提条件未满足，已在看板标注「Playtest 待补」）。

- E2-101 停车场 polish（f1ce362）：驶出粒子尾迹+出口箭头点亮；胜利保留棋盘背景、结果卡底部弹出（再来一局主按钮）；PuzzleScene.exit 放宽为 protected。
- E2-200~202 合成水果（acd1c19）：落点线+投影、投放初速、新预览轻弹；合并涟漪+浮字+按水果色粒子；650ms 连锁 ×N 表现（不改计分）；大水果碗震+极轻 camera shake；危险线 620ms 呼吸；结算保留水果堆+底部弹卡。
- E2-300~302 切水果（8000a88）：ActionScene 拆 showHud/showResult 可覆写 hooks（默认旧行为，其余三款动作游戏零改动）；玩具柜 intro（浮动装饰水果+开始主按钮+难度次级+滑动教学）；开局「开始！」不阻塞；HUD 拆大数字分数+时间块（末 10 秒变橙）；结算保留最后一帧。
- E2-400~402 Home 2.0（81a6a06）：「今天想玩什么？」hero+继续玩绿卡直达；儿童分类文案（全部/动脑筋/拼一拼/手要快/一起玩，内部 ID 不变）；检查更新/整理图标折叠进页脚家长设置；卡片按压 0.96+图标下沉。
- E2-500~501 小树成长（3c5eec3）：tree.ts 本地存储（叶子只增、里程碑只发一次、坏档容忍）；recordFlag 与动作新纪录统一发叶；大厅 SVG 小树七阶段；无签到/无倒计时/无催促。
- 测试基线 206→212（38 文件）；全部经 CDP 真实操作验收。
- Wave 1~5（全库 24 游戏 L3 迁移）与 Content Pass（推箱子 30 关、数织 30 图等）仍为 `BACKLOG`，属第二阶段。

## 2026-09-17 — v0.3（Sprint 0/1/2 落地）

- E2-000 基线：`docs/experience-2-baseline.md`（大厅/停车场/合成水果/切水果 CDP 实拍与行为实录，192 测试）。
- E2-010~013 primitive：新增 `src/experience/`（feedback/motion、floating-text、particles；input/axis-drag-core 纯计算 + axis-drag 控制器）。无新依赖、无游戏行为改变。
- E2-100 停车场直接拖车（commit 8306049）：
  - 主操作 = 按住车轴向拖动（pickup 放大置顶、8px 橡皮筋阻挡、松手半程滞回吸附后仅此刻 `slide()` 提交）；
  - 拖动期间零 draw / 零存档 / 零求解；轻点退回旧点选路径作辅助；
  - 修复体验层两处缺陷：拖动包络并入当前位置（静止指针不再被拉向停靠点）、`shouldCommitStop` 滞回（轻扫不误提交）。
  - 工程验收：206 测试全绿；CDP 竖屏 768×1024 与横屏 1024×768 实测拖车、跨多格一次一步、横车竖拖不动、
    越界吸附不穿车、undo、草稿落盘、退出重进续玩一致、BFS 三步通关（红车 80ms 停顿后加速驶出 + 庆祝）。
  - 状态：`PLAYTEST`，等待真实孩子按 §82 验收卡试玩。
- 已知限制：CDP 无法模拟 Safari 真机触摸（touch-action / pointer capture 需 iPad 确认）；
  拖动中的多点触控用 draggingId 互斥，未做双指场景测试。

## 2026-09-17 — v0.2

补全长期执行规范：

- 增加 Document Control；
- 增加总任务看板与 WIP 限制；
- 增加 L0–L4 Experience 成熟度；
- 增加 24 游戏完整迁移矩阵；
- 增加全局 / Direct Manipulation / Animation / Audio / Result DoD；
- 增加 Codex Green / Yellow / Red 变更边界；
- 增加 Hard No 禁区；
- 增加 Stop Conditions；
- 增加 Definition of Ready；
- 增加 Sprint 固定输出协议；
- 增加 Git / Commit 规范；
- 增加公共层回归矩阵；
- 增加浏览器 / iPad 验收矩阵；
- 增加性能预算；
- 增加儿童友好约束；
- 增加人工 Playtest 记录模板与决策门；
- 增加参数调优和“三次规则”；
- 增加 Home / Meta / Content DoD；
- 增加 Bug 分级；
- 增加生命周期、存档、动画中断、多点触控规范；
- 增加旗舰游戏 Playtest 验收卡；
- 增加全库迁移 Wave；
- 增加 ADR 和 Agent Review 建议；
- 增加 Experience Debt 台账；
- 增加文档同步规范。

---

# 93. 下一步唯一推荐动作

现在这份文档已经足够作为长期主规范。

不要再继续扩写架构。

下一步直接执行：

```text
E2-000 — Baseline
↓
E2-010 / E2-013 — 最小 motion + axis drag
↓
E2-100 — Parking Direct Manipulation
↓
真实 iPad / 女儿 Playtest
```

**Parking Playtest 之前，不开始 Home 2.0，也不开始 Meta Tree。**

如果停车场的真实体验没有出现明显提升，优先调整手感与交互假设，而不是继续扩建 Experience framework。
