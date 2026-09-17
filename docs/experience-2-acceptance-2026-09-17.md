# Experience 2.0 独立验收（2026-09-17）

结论：**不通过，退回修复后复验**。规则单测与构建通过不等于新交互通过。

验收对象为 `263e466..1446e80`，包含 Experience primitives、停车场、合成水果、切水果、Home/Tree、五个迁移波次及 `c4fb94e` stabilization，共 42 个变更文件。依据 `AGENTS.md`、`docs/EXPERIENCE-2.md` 和 stabilization 文档。此次只记录验收结果，不改产品实现、不部署、不推送。

## 必须修复的问题

### A1 · P1 · 数织扩容使旧存档失效、旧完成记录错配

位置：`src/games/nonogram/core/game.ts:34`，关联 `src/games/puzzle-kit/core/drafts.ts:26`、数织 scene 和 progress。

扩容把变体插入每张原图之后，改变既有数字 level 的含义，但棋盘仍使用 v1 存档、完成记录仍使用 `nonogram-N`。旧 level=5 的 10×10 图案现在对应 5×5「小爱心·夜斜」。浏览器导入实际 restoreNonogram，以旧格式 `{ state: { level: 5, marks: Array(100).fill(0), won: false }, history: [], assisted: false }` 调用，返回 `null`。旧 5×5 棋盘即使长度校验通过，也会恢复到不同图案；完成标记同步错配。

要求：保留原 9 幅的稳定身份，或提供明确的棋盘、撤销历史、完成记录迁移；不能仅通过清档或新键丢弃旧进度。补旧版真实存档兼容测试。

### A2 · P1 · 三款纸牌拖动的对象不在显示列表，牌没有跟手

位置：`src/games/freecell/scene.ts:57`、`src/games/spider/scene.ts:50`、`src/games/klondike/scene.ts:49`；共同关联 `src/games/cards/card-view.ts:51`。

复现：新开任意上述纸牌，按住第一列最上方可移动牌，移动约 130×60 逻辑像素但不松手。真实 CDP 鼠标按下/移动后，三款的 `dragGroup[0]` 坐标均改变，但 `scene.children.list.includes(dragGroup[0])` 均为 false；画面里的新牌仍在原列。空当接龙示例：拖动对象 x≈215.67，而可见列顶牌 x=91。

原因：dragstart 缓存旧 view，同时仍保留原 pointerdown 的选择路径；选择路径调用 draw/removeAll 重建显示，后续 drag 操作旧 view。松手可能仍能提交规则动作，因此仅检查 moves/state 会产生假通过。

要求：把轻点选择与实际拖动协调为单次输入会话，拖动中不重建相关 view。测试必须断言按住期间可见牌的位置、组内相对位置、显示层级，并覆盖轻点、五种 FreeCell 移动、撤销与自动收尾。

### A3 · P1 · 停车场连续拖车可留下永久输入锁

位置：`src/games/parking/scene.ts:216`，特别是 233–235 行。

commitDrag 在吸附开始时清除 draggingId，允许立即拖另一辆车；旧的 160ms snap 完成后却调用整盘 draw，销毁新拖动的 controller/view。新会话的 draggingId 没有被解除，所有新 controller 的 isEnabled 都返回 false，撤销/换局/难度也受 draggingId 守卫阻挡。

浏览器场景时序探针：提交一个合法非获胜移动，立即调用另一辆车 controller.begin，等待 350ms，得到 `{ draggingId: 0, active: 0, enabled: false }`，无运行时异常。此证据验证了回调竞态；仍需把对应快速连续触控加入永久端到端回归。

要求：吸附完成只更新原车，或对重绘/新会话做明确协调；取消或销毁会话必须解除锁，不能由过期动画毁掉新输入。

### A4 · P2 · 停车场每次重绘累积 shutdown 监听器

位置：`src/experience/input/axis-drag.ts:58`、`:102`。

构造器用匿名 once 回调注册 shutdown；destroy 只移除输入监听器，没有注销该生命周期回调。每次 draw 为每辆车重新创建 controller，旧 controller、旧 view 与闭包仍被 scene.events 持有直到退出。

浏览器实测，同一局调用 draw 30 次，shutdown listenerCount 从 19 增至 199（每次增加 6）。正常点选和松手也会走 draw，因此是局内累积，不会被「进出游戏后 DOM 监听器不增长」的测试发现。

要求：保存并注销生命周期 handler，覆盖 SHUTDOWN/DESTROY 且幂等；重复交互后数量保持稳定。

### A5 · P2 · 扩容内容未全部接入玩家入口

位置：`src/games/nonogram/scene.ts:8,34,70`；`src/games/sokoban/core/game.ts` 的 CHALLENGE_LEVELS 以及 `src/games/sokoban/scene.ts:38`。

数织仍从 level=5 开始，「下一幅」末尾仍回到 5，正常新玩家无法进入索引 0–4，无法达成大厅宣传的全部 50 幅。

推箱子新加第 11–18 关的 PAR 为 4–7，被原有 PAR≥8 的筛选全部排除；选关和「下一关」均只遍历 CHALLENGE_LEVELS。实际选关为 18 个入口：4/5/7/8/9/10/19–30，第 10 关后跳到 19，新增八个学习关没有入口。筛选规则本身是旧行为，但本轮声称交付的三段内容梯度并未真正可玩。

要求：明确产品希望保留挑战筛选还是开放完整内容；按最终决定增加入口/分组并对齐总量文案与文档。不要直接把旧的难度约束悄悄删除。

### A6 · P2 · 正式浏览器回归脚本未随重构更新

位置：`scripts/browser-smoke.mjs:164–172,238`。

原版 `pnpm test:browser` 实际 FAIL 于 172 行。它把 level=5 当成原 10×10 图，仍用旧坐标划格；现已变成 5×5。切水果仍点击旧的 `(160,400)` 难度按钮，实际开始按钮已改为 `(384,508)`。

临时副本改用动态查找 10×10 图及新的切水果入口后，横竖屏益智、音频、续玩、退出边界与局间资源检查可以继续完成；但整套副本随后在动作测试的 `assert.ok(bubble)` 处失败，不能宣称全套浏览器回归通过。该采样失败未单独判为产品缺陷。

要求：更新正式脚本的语义定位，增加上述新交互、中断、旧档兼容回归；修复后须完整跑绿，不能只引用历史 CDP 抽查。

## 验收覆盖与结果

| 项目 | 结果与边界 |
| --- | --- |
| 类型、规则单测、构建 | `pnpm check` PASS，38 文件/215 测试；已有 Phaser 大包告警 |
| diff 格式 | `git diff --check` 和 `git diff 263e466..HEAD --check` PASS |
| 规则/内容层 | 全量单测含所有数织唯一解、推箱子可解与 PAR；不覆盖旧数织 level 身份迁移 |
| 原版浏览器脚本 | FAIL，见 A6 |
| DPR=2 渲染 | `RENDER_ONLY=1 pnpm test:browser` PASS，8 类游戏 × 768×1024 / 1024×768 |
| 本地生产 PWA | `PRODUCTION_ONLY=1 APP_URL=http://127.0.0.1:4173 pnpm test:browser` PASS；SW 接管、三款游戏横竖屏、断网后水排序重开，不等于全库离线通关或旧版本升级测试 |
| 横竖屏益智/音频 | 临时调整脚本通过分类、续玩、数独笔记、数织连续划格/整笔撤销、七巧板、静音恢复、退出确认；数独 4×CPU 选格约 3–5.3ms |
| 场景切换资源 | 临时脚本 DOM/事件检查 723/57 → 685/54；局间通过不消除 A4 的局内累积 |
| 三款纸牌 | 真实鼠标拖动观察到 A2；空当接龙有移动成功路径，不能据此判定拖牌手感通过 |
| 停车场 | 普通入口/渲染可用；时序探针复现 A3/A4，不能验收为完成 |
| 合成水果 | 浏览器连续真实点击投放 7 次，触发合并得 4 分、场上 5 颗，Matter sleeping=false；再经场景探针触发结算，零运行时异常。未穷尽自然满杯/支撑消失/所有连锁路径 |
| 四款动作游戏 | 逐款启动、将倒计时推进至结束、显示保留背景的结果卡、真实点击再来一次，running 均恢复 true；切水果 HUD 也恢复。未以此替代完整自然时长回合 |
| 稳定化三项 | 单测确认数织总数来自 PATTERNS、推箱子后续关卡计入并过滤所测非法 key；FreeCell foundation 已无 draggable 注册。由于 A2，不能认定该 Sprint 的其他拖动回归全部通过 |
| Home/Tree | 审查大厅入口、分类、家长设置、树存储及七阶段实现；相关单测通过。真实玩家重复游玩收益仍无证据 |
| 线上只读核对 | HTTPS 下载 index.html、sw.js、manifest 均 200，no-cache 策略符合预期，三文件逐字节等于本次本地 dist。没有部署或修改服务器 |

## 文档与范围结论

- 这是大部分工程功能已经落地、仍有关键回归的版本，不能称为 Experience 2.0 稳定版。
- 数独/接水管迁移仍是 BACKLOG，七巧板内容扩展明确 WONT_DO；这些属于已记录的未完成范围，不混同本次回归。
- 看板 DONE 与自身「工程验收 + Playtest 决策」定义仍有不一致；例如卡牌 DONE 没有通过 A2。E2-011/012 的「尚未接入游戏」描述也已过时。
- 根 AGENTS 产品表仍写推箱子 10 关、数织 9 幅，和代码/README 不一致，后续应同步。
- 未验证真实 iPad Safari、主屏幕旧 PWA 更新、人耳听感及孩子 Playtest；未实玩全部游戏到通关。发现阻塞不应被解释为其他未穷尽路径已通过。

## 复验顺序与证据

先修 A1/A2/A3，再修 A4/A5/A6；重跑正式检查、横竖屏真实操作和存档迁移，最后进入 iPad 与孩子 Playtest。

本机临时证据（不作为可永久保留的仓库资产）：

- `/tmp/games-audit.mjs`：纸牌初查、数织旧档、选关、监听器、四动作 replay。
- `/tmp/games-audit-focus.mjs`：数织、选关、停车场动画竞态。
- `/tmp/games-audit-cards.mjs`：按住期间 dragGroup 与可见 view 的观察。
- `/tmp/games-smoke-adjusted.mjs`：临时适配脚本；整体仍 FAIL，不可当正式通过结果。
- 截图目录：`games-browser-report-UQIPBE`（动作结果等）、`games-browser-report-qCfizY`（内容/停车场探针）、`games-browser-report-XOCHqe`（三款牌拖动中）、`games-browser-report-zOzXsa`（Retina）、`games-browser-report-sn4qUn`（生产 PWA），均在本机 `$TMPDIR`。

工作区原有未跟踪 `.zcode/` 保留。交付只新增本验收报告；产品缺陷尚未修复。
