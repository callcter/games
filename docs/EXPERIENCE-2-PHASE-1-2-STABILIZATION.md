# 小树游戏屋 Experience 2.0 — Phase 1/2 Stabilization Sprint

> 用途：交给 Codex 执行。
>
> 目标：在 Experience 2.0 第一、二阶段工程改造完成后，做一次**只修回归、不扩功能**的稳定化收口。
>
> 当前阶段禁止新增体验、禁止继续 polish、禁止新增游戏。

---

## 0. 执行前要求

先完整阅读：

```text
AGENTS.md
docs/EXPERIENCE-2.md
src/app/app.ts
src/app/library.ts
src/games/puzzle-kit/progress.ts
```

然后重点检查：

```text
src/games/nonogram/
src/games/sokoban/
src/games/freecell/
```

必须以**当前工作树**为准，不要仅依赖本文档中的静态描述。

开始修改前先运行：

```bash
git status
pnpm check
git diff --check
```

如果当前工作树存在与本任务无关的未提交修改：

- 不要覆盖；
- 不要 reset；
- 不要自动 stash；
- 在最终报告中说明。

---

# 1. 本 Sprint 的唯一目标

修复第一、二阶段改造后已经确认存在的跨层回归，并同步 Experience 2.0 文档状态。

本 Sprint 只允许处理以下四类内容：

1. 数织大厅进度统计；
2. 推箱子大厅进度统计；
3. FreeCell Foundation 无意义拖动；
4. `docs/EXPERIENCE-2.md` 状态同步。

除此之外：

> **禁止顺手继续做第三阶段体验改造。**

---

# 2. 问题一：数织进度总数仍写死为 9

## 现状

数织内容已经从原先的约 9 幅扩展到更多内容。

游戏本身已经按照当前 pattern 数据工作。

但大厅长期进度摘要仍存在历史写死值，类似：

```ts
flagLine('nonogram-', 9, '画')
```

这会导致：

```text
已画 17 / 9 幅
```

这样的错误展示。

---

## 修改目标

大厅进度总数必须与当前实际数织内容一致。

### 推荐方案

优先消除重复写死的内容总数。

例如：

```ts
export const NONOGRAM_PATTERN_COUNT = PATTERNS.length
```

然后进度摘要引用这一唯一来源。

或者使用仓库当前结构下更自然的 metadata/constants 方案。

### 要求

不要只为了过任务简单：

```text
9 → 50
```

如果能够在不制造循环依赖、不破坏模块边界的前提下消除重复常量，应优先这样做。

但是：

> 不要为了消除一个常量而进行全局 content registry 大重构。

---

## 验收

至少测试：

```text
0 幅
1 幅
超过 9 幅
全部完成
```

大厅摘要的：

```text
已画 X / N 幅
```

必须正确。

---

# 3. 问题二：推箱子进度只统计前 10 关

## 现状

推箱子已经扩容到更多关卡。

但大厅进度摘要仍存在旧逻辑，类似：

```ts
Number(match[1]) < 10
```

导致：

```text
第 11～后续关卡完成记录
```

不会被计入大厅长期进度。

---

## 修改目标

所有当前有效推箱子关卡的完成记录都必须参与统计。

### 要求

不要根据历史关卡上限硬编码：

```text
< 10
< 30
```

应该根据：

- 当前有效关卡 ID；
- 当前关卡数量；
- 或现有 level metadata；

进行判断。

如果存档 key 可能包含非法/旧数据：

- 继续过滤非法 key；
- 不要简单统计所有 `sokoban-*`。

---

## 验收

至少覆盖：

```text
第 1 关
第 9 关
第 10 关
第 11 关
最后一关
非法 key
超出当前关卡范围的旧 key
```

大厅：

```text
已过 X 关
```

必须正确。

---

# 4. 问题三：FreeCell Foundation 不应该可拖

## 现状

当前 Foundation 顶牌被设置成 draggable。

但拖动结束逻辑实际上只支持：

```text
tableau
freecell
```

作为有效 source。

Foundation source 没有对应合法提交语义。

结果是：

```text
玩家可以拿起 Foundation 牌
→ 拖动
→ 无论如何都无法完成动作
→ 弹回
```

虽然 core 会拒绝非法状态，不会破坏游戏数据，但这是错误的交互 affordance。

---

## 修改目标

如果当前 FreeCell 规则不支持：

```text
Foundation → Tableau / FreeCell
```

那么 Foundation 顶牌就不应该进入 draggable 状态。

### 推荐行为

Foundation 牌：

```text
可以显示
可以作为 drop target
不能作为 drag source
```

### 不要做

本 Sprint 禁止为了“让 Foundation 拖动变合理”而新增：

```text
Foundation → Tableau
Foundation → FreeCell
```

规则。

这会改变游戏规则，不属于 stabilization。

---

## 验收

确认：

- tableau → tableau 正常；
- tableau → freecell 正常；
- tableau → foundation 正常；
- freecell → tableau 正常；
- freecell → foundation 正常；
- foundation 顶牌无法被拖起；
- undo 正常；
- 自动收牌行为不受影响；
- 胜利流程不受影响。

---

# 5. 文档状态同步

文件：

```text
docs/EXPERIENCE-2.md
```

当前已存在第一、二阶段已经实际完成，但任务看板/迁移矩阵仍保留旧状态的情况。

本 Sprint 需要做一次**文档与代码对齐**。

---

## 5.1 Task Board

逐项核对：

```text
DONE
PLAYTEST
BACKLOG
```

不要仅根据旧文档改。

必须根据当前代码和 changelog 判断。

例如：

如果某项已经实际实现并完成工程验收：

```text
不能继续标 BACKLOG
```

---

## 5.2 Migration Matrix

更新已经发生明显 Experience 提升的游戏等级。

不要机械全部升一级。

等级必须符合文档里现有 L0～L4 定义。

例如：

停车场完成 Direct Manipulation 后：

```text
不应该继续保持最初的 L0
```

但是否是 L2 / L3，应按现有定义判断。

---

## 5.3 Changelog

保留已完成记录。

追加本次 stabilization：

```text
Phase 1/2 stabilization
```

至少写清：

- Nonogram progress fix；
- Sokoban progress fix；
- FreeCell foundation drag fix；
- 文档状态同步；
- 测试结果。

---

# 6. 测试要求

修改完成后必须运行：

```bash
pnpm check
git diff --check
```

如果仓库还有更细粒度 test 命令，针对本次修改补充执行。

---

## 6.1 推荐新增/修改的单元测试

优先给：

```text
src/games/puzzle-kit/progress.ts
```

相关纯逻辑增加测试。

至少证明：

### Nonogram

```text
总数不再使用旧值 9
```

### Sokoban

```text
关卡 > 10 仍正常统计
非法/超范围 key 不统计
```

---

# 7. 浏览器回归

本 Sprint 虽小，仍然需要实际打开浏览器检查。

至少检查：

## 大厅

进入大厅，验证：

```text
数织进度
推箱子进度
```

展示没有：

```text
X / 9
```

等历史错误。

---

## FreeCell

手动验证：

```text
Foundation 牌不能被抓起来
```

同时至少完成几次正常拖牌。

---

# 8. 禁止修改范围

本 Sprint 明确禁止：

```text
新增游戏
新增 Meta Tree
Home 3.0
新增动画
新增粒子
新增音效
修改数织关卡内容
修改推箱子关卡内容
修改 FreeCell 游戏规则
重构 PuzzleScene
重构 ActionScene
重构整个 progress 系统
引入新 npm dependency
修改 Service Worker 架构
部署
push
```

---

# 9. 变更原则

必须遵守：

> 修 bug，不扩 scope。

如果执行过程中发现其他问题：

- 记录；
- 不顺手修；
- 在最终报告中放入 `Follow-up findings`。

只有以下情况可以顺带修改：

> 不修改就无法正确完成本 Sprint。

并必须在最终报告里说明理由。

---

# 10. Git 提交

完成并通过验证后提交一个独立 commit。

推荐：

```text
fix: stabilize experience phase 1 and 2
```

不要 push。

不要 deploy。

---

# 11. 最终报告格式

Codex 最终必须按以下格式报告：

```markdown
## Result

### Fixed
- ...
- ...
- ...

### Files changed
- `...`
- `...`

### Tests
- `pnpm check`: PASS / FAIL
- `git diff --check`: PASS / FAIL
- unit tests: ...
- browser verification: ...

### Behavior verified
- Nonogram:
  - ...
- Sokoban:
  - ...
- FreeCell:
  - ...

### Documentation sync
- Task Board:
- Migration Matrix:
- Changelog:

### Follow-up findings
- None
或
- ...

### Commit
`<hash> fix: stabilize experience phase 1 and 2`
```

---

# 12. 完成定义

只有同时满足以下条件，本 Sprint 才算完成：

- [ ] 数织大厅进度总数正确；
- [ ] 数织不会再显示历史 `/ 9`；
- [ ] 推箱子第 11 关及以后能被正确计入；
- [ ] 超范围/非法推箱子 key 不会被错误计入；
- [ ] FreeCell Foundation 不再是 drag source；
- [ ] 其他 FreeCell 拖动行为正常；
- [ ] undo / save / win 等未回归；
- [ ] 相关测试已补；
- [ ] `pnpm check` 通过；
- [ ] `git diff --check` 通过；
- [ ] 浏览器回归完成；
- [ ] `EXPERIENCE-2.md` Task Board 已同步；
- [ ] Migration Matrix 已同步；
- [ ] Changelog 已同步；
- [ ] 已创建本地 Git commit；
- [ ] 没有 push；
- [ ] 没有 deploy。

---

# 13. 本 Sprint 完成之后

完成后：

> **停止继续开发 Experience 2.0 新功能。**

下一步不是立即进入第三阶段。

下一步是由真实玩家进行 Playtest。

重点观察：

```text
停车场
合成水果
切水果
自由选择游戏
```

核心指标：

```text
停车场：
是否自然直接拖车？

合成水果：
发生合并以后是否继续主动投放？

切水果：
结束后是否主动点击“再来一次”？

全局：
20～30 分钟自由使用时，实际反复打开哪些游戏？
```

Playtest 结果出来后，再决定 Experience 2.0 下一阶段内容。

不要提前假设第三阶段一定是：

```text
大厅
Meta Tree
更多动画
更多内容
```

下一阶段应该由真实使用行为驱动。
