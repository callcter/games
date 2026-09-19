# games 运维手册（games.dreamser.com）

小树游戏屋 PWA 的线上架构、发版流程、证书与故障排查记录。
所有服务器操作前先读本文档；变更后更新「变更记录」一节。

## 1. 架构总览

| 项 | 值 |
| --- | --- |
| 形态 | 纯静态 PWA（Service Worker 离线缓存，无后端） |
| 域名 | games.dreamser.com（HTTP 301 → HTTPS） |
| 服务器 | ubuntu@101.42.50.27（ssh 端口 1991） |
| 站点目录 | /home/www/games（仅放 dist 产物） |
| nginx 配置 | /etc/nginx/conf.d/games.dreamser.com.conf |
| 证书 | Let's Encrypt，一张 SAN 证书覆盖 dreamser.com + www.dreamser.com + games.dreamser.com，路径 /etc/letsencrypt/live/dreamser.com/（两个站共用） |
| DNS | DNSPod 托管（albert/bedroom.dnspod.net），所有域名 → 101.42.50.27 |

同机还有其他站点（dreamser.com 主站、egg、love、report、agantouyan 系列等），
以及 sites-enabled/mcp.conf（8085，quant-data MCP 反代）——改 nginx 时不要碰它们。

## 2. 日常发版

```bash
pnpm run deploy   # = pnpm run build && scp -P 1991 -r dist/* ubuntu@101.42.50.27:/home/www/games
```

- 本地是唯一改代码的地方；服务器上的 /home/www/games 只是产物，**严禁在服务器上直接改**。
- 默认工作流（用户 2026-09-19 长期授权）：每个迭代批次验收通过后即推送 + 部署 +
  发版只读验证，不逐批询问；用户对某批明确说「先不发」时单独豁免。
  发布前置条件（有效全量验收 + 专项证据，见 [AGENTS.md §12](../AGENTS.md#12-git-工作规范)）
  不因授权常驻而降低。
- 开发与本地提交按 [AGENTS.md §10](../AGENTS.md#10-测试与验收) 选择检查，不逐次全量。
  相同相关代码/配置/依赖的通过结果可复用，仅补文档无需重跑。
- `deploy` 自带构建；已完成 check 后不再手动额外跑一次 build。发布后的版本一致性仍必须核验。
- 发版后新版本如何到达 iPad：注册的 SW 是 `registerType: 'prompt'`，
  iPad 下次联网打开时检测到新 SW，退出当前游戏后提示更新，**不会在游戏中途刷新**。

## 3. nginx 缓存策略（PWA 关键，改动前必读）

| 资源 | 策略 | 原因 |
| --- | --- | --- |
| /sw.js | no-cache, no-store, must-revalidate | 新版本发布靠 SW 传播，被 HTTP 缓存卡住就永远更新不了 |
| /manifest.webmanifest | no-cache（MIME 强制 application/manifest+json） | Safari 添加到主屏幕依赖它 |
| /index.html | no-cache | 入口页即时生效 |
| /assets/*（带内容 hash）、workbox-*.js | public, max-age=31536000, immutable | 文件名含 hash，可安全长缓存 |

注意：workbox 规则用的是通配正则 `~* ^/workbox-[^/]+\.js$`，
因为该文件名里的 hash 每次构建都会变，写死会失效。

## 4. 证书自动续期

- **certbot 安装方式**：独立 venv `/opt/certbot`（软链 /usr/local/bin/certbot）。
  原因：服务器默认 python3 指向损坏的 3.11.0rc1，apt 版 certbot 装上即崩
  （缺 `_cffi_backend`/`apt_pkg`）；venv 用的是完好的 `/usr/bin/python3.10`。
  **不要 apt install/remove certbot**——remove 会 mask 掉 certbot.timer。
- **续期触发**：systemd `certbot.timer`（每天 02/14 点，RandomizedDelaySec 1h）。
  单元文件在 /etc/systemd/system/certbot.{service,timer}（pip 版不带，手动建的）。
- **验证方式**：`sudo certbot renew --dry-run`（走 Let's Encrypt staging 全流程模拟）。
- **续期机制**：HTTP-01 webroot，验证路径 `/.well-known/acme-challenge/` → /var/www/letsencrypt。
  dreamser.com 和 games 两个 conf 的 80 端口都保留了该 location，**删掉它续期就断**。

### 自动续期的两个前提（守住即可永久免维护）

1. 域名 DNS 始终指向 101.42.50.27；
2. 80 端口可从公网访问（改防火墙/安全组前先想一下）。

若换服务器 IP：改 DNS → 在新机器重签证书 → 更新两个 conf 的证书路径。

### 历史上的证书形态（避免混淆）

- 2026-09-15 前后短暂用过手动上传的腾讯云 TrustAsia DV 证书（conf.d/*.crt），
  因免费版不能自动续，已全部切回 Let's Encrypt，腾讯云证书不再使用。
- 2026-09-16 应需求把 www.dreamser.com 加入 SAN（DNSPod 补了 www A 记录）。

## 5. dreamser.com 主站 conf 的坑

80 端口的跳转**必须写在 `location /` 里**，不能写在 server 块顶层：

```nginx
# 错误：server 顶层 rewrite 在 location 匹配之前执行，会把
# /.well-known/acme-challenge/ 的续期验证请求也 301 掉 → 续期失败
rewrite ^(.*)$ https://${server_name}$1 permanent;

# 正确：
location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
location / { return 301 https://$host$request_uri; }
```

跳转用 `$host`（保留用户实际访问的域名），不要用 `$server_name`。

## 6. 故障排查手册

### 站点 5xx / 打不开

1. 本地 `curl -sI https://games.dreamser.com/` 看状态码，对照测主站判断影响面。
2. 服务器上按**状态码位置**精确搜日志（避免把响应字节数误当状态码）：
   `sudo grep -hE '" 50[0-9] ' /var/log/nginx/access.log /var/log/nginx/access.log.1`
3. 纯静态 + return 301 的 server 块不可能产生 502；502 只能来自 proxy_pass 的站点。
   若目标域名日志里无任何 5xx，说明响应不是这台 nginx 发的——往中间层查（DNS 缓存 / CDN 残留）。

### 案例：2026-09-15「www.dreamser.com 502」

现象：用户访问 www 报 502，但服务器 access.log 零 5xx 记录。
根因：DNSPod 上 www 记录早已不存在（权威与公共递归均查无），
用户设备/运营商 DNS 缓存着旧解析（指向历史 CDN 层），由那一层回源失败返回 502。
修复：DNSPod 补 `www A 101.42.50.27` + 证书 SAN 加入 www。
教训：看到 502 先确认「这个响应到底是谁发的」，别急着动服务器。

### 证书签发报 NXDOMAIN

Let's Encrypt 用全球多视角 DNS 验证，可能命中刚删除记录的负缓存
（DNSPod SOA negative TTL = 180 秒）。等 3 分钟重试即可，不用改任何东西。

### certbot.timer 不跑

`systemctl is-active certbot.timer` 若为 masked/inactive：apt 卸载 certbot 的副作用。
修复顺序有讲究——**先 unmask 再写单元文件**（反过来 unmask 会把新写的文件一起删掉）：
`sudo systemctl unmask certbot.timer` → 写回 /etc/systemd/system/certbot.timer →
`daemon-reload` → `enable --now`。

## 7. 服务器环境备忘

- Ubuntu 22.04，nginx 1.18.0；git/构建都在本地，服务器不放源码。
- python3 被 alternatives 指向损坏的 3.11.0rc1；完好的解释器是 /usr/bin/python3.10。
- `sudo nginx -t` 会报两条 101.42.50.27 server_name 冲突警告和若干 ssl 指令 deprecated
  警告，均为历史遗留（dreamser.com/egg/capital 等 conf），无害，与 games 无关。
- 改 nginx 的固定动作：先 `cp xxx.conf xxx.conf.bak.$(date +%Y%m%d)`，
  改完 `nginx -t` 通过再 `systemctl reload nginx`（平滑重载不断连接）。

## 8. 变更记录

- 2026-09-19 发布 `83483d7`（2 个提交）：修复 2048 越玩越卡——Phaser 4 的
  `scene.children.removeAll(true)` 是 structs/List 的 skipCallback 语义（只摘
  列表不销毁对象），七个全量重绘场景误用导致 Text canvas 纹理随每步重绘永久
  累积（实测 300 步 138→6713 张、FPS 53→18）。新增 clearSceneChildren 逐对象
  destroy 替换七处，复测纹理收敛 34 张；shell-regression 增加 2048 纹理收敛
  断言。验证：shell/smoke/ui/modal/check 225/生产离线全部通过。已推送 GitHub。

- 2026-09-19 发布 `89e52af`（4 个提交）：顶栏全站统一收口——纸牌三款与合成
  水果接入共享 createPuzzleChrome（紧凑档贴牌桌、蜘蛛难度收进完成槽行留白、
  合成水果得分进状态胶囊且「下一个」气泡避让声音钮）；水排序/叠叠消自绘圆
  钮头换共享顶栏、难度 pill 入状态行；删除无调用方的 platform header-button
  与 cozy 圆钮桥接。至此 24 款顶栏全部走同一组件（各按自身布局适配）。
  验证：pnpm check 225、完整 smoke（监听器 57→48）、ui/modal/shell 专项
  （两款难度循环与三款纸牌翻牌/难度/帮助实测）、RENDER_ONLY、生产离线、
  75 张重拍全部通过；关键图目视。发版后 HTTPS 200、关键产物 SHA-256 一致。
  已推送 GitHub。

- 2026-09-19 仅更新协作政策，未发布：AGENTS.md 新增 §16「外部协作与交接」——
  向外部复审者交付可复现材料、接收修正包择优合入、接手/中断现场与台账纪律。

- 2026-09-19 发布 `3c23c8f`（5 个提交）：外部审查（codex）对统一顶栏批次的
  九项问题全部修复（台账 docs/reviews/2026-09-19-shell-v4-review.md）——共享
  chrome 按实际占用布局+旋转重排+紧凑档；三处 FIT 挂载 resize→setGameSize
  修旋转画布比例失真；scene-modal 同帧关-开竞态归属修复；共享结算卡旋转重排；
  扫雷提示/难度错开；俄罗斯方块侧栏按实际高度分区、窄屏新增得分/预告/暂存
  紧凑信息行；截图脚本重写为独立浏览器+新局 fixture+路由断言并输出 manifest
  （修复两张 home.png 误拍叠叠消、多图被弹窗遮挡）。验证：pnpm check 225、
  完整 smoke（监听器 55→48）、ui/modal/shell 专项、生产离线专项通过；75 张
  重采。发版后 HTTPS 200、关键产物 SHA-256 一致。已推送 GitHub。

- 2026-09-19 发布 `bfd46a6`（4 个提交）：75 张截图自查修复与顶栏全站统一——
  切水果厨房背景改场景级按实际画布高 cover（补 v4 遗漏，含每回合防叠加守卫）、
  合成水果顶部加米色渐变衬底并调整"下一个"标签间距；截图初判的另 6 项问题
  （键盘/轮廓/按钮/槽位裁切、状态溢出、2048 布局、分类重复）经 getBounds
  程序化测量全部证伪为视觉误判。随后按用户要求消灭最后顶栏年代差：2048/
  五子棋/俄罗斯方块/扫雷从 LegacyChrome 迁移共享 createPuzzleChrome
  （新增可选 tools；扫雷旗数/表情/计时并入状态胶囊；方块操作提示入胶囊），
  LegacyChrome 至此无调用方。验证：tsc/225 单测/构建、完整 smoke（监听器
  52→48）、ui-regression、RENDER_ONLY DPR=2、四款×三视口专项与 75 张
  全量截图目视合格。发版后 HTTPS 200、关键产物 SHA-256 一致。已推送 GitHub。

- 2026-09-19 发布 `ae8db20`（6 个提交）：合入外部审查的 game-shell-consolidation
  v4 公共外壳收敛（逐行审查后择优采纳）——益智/动作游戏挂载改 portrait-fluid
  （宽 768、竖屏逻辑高 900~1680 随宿主、横屏回退 900 FIT），顶栏统一共享
  createPuzzleChrome（圆形图标+标题胶囊），玩法坐标保持 768×900 由内容层
  纵移与 legacyPoint 换算（七处裸指针命中全部适配），动作游戏难度页/
  结算统一共享组件、背景按实际画布高 cover。拒绝其 canvas CSS patch
  （违反 §5.2 复用约束）。三个回归脚本坐标体系随之适配（按场景实际逻辑高
  换算 + 帧边界事件等待）。验证：tsc+225 单测+构建、完整 smoke 横竖屏、
  ui-regression、RENDER_ONLY DPR=2、监听器 57→48 不增长全通过；75 张
  三视口截图全量重摄（screenshots/）供外部复审。发版后 HTTP 301→HTTPS、
  证书（至 2026-12-14）、no-cache/immutable 缓存头正常，sw.js/index/
  manifest/关键分包 SHA-256 与本地 dist 一致。发布后已推送 GitHub。

- 2026-09-19 发布 `2590d74`（7 个提交，含审查与协作政策文档）：审查报告六项修复
  全部落地——共享帮助面板重写为原生 `<dialog>` DOM 模态（正文不被背景遮挡、
  输入天然隔离、幂等 dispose、场景统一 sys.pause，修复手动看规则不暂停与
  关闭→重开帧边界竞态）；五子棋棋盘独立容器+专用相机视口缩放（顶栏各档位
  不消失，拖动/点按/捏合判定拆分）；14 张重素材 PNG→WebP（预缓存 36.99→
  31.36MiB）并恢复 2MiB 单文件上限、新增 32MiB 总量构建门禁；生产验收脚本
  改 Node 侧读清单 + `/src/` 请求即失败门禁 + 真实离线首弹验证（解除
  AGENTS.md 已知阻断）；新增 `pnpm test:browser:ui` 新用户回归与共享
  scripts/lib。验证：pnpm check 225 测试全绿、dev 完整回归、UI 专项、
  PRODUCTION_ONLY=1 离线专项均通过且截图逐张目视；发版后 HTTP 301→HTTPS、
  证书（至 2026-12-14）、no-cache/immutable 缓存头正常，sw.js/index/
  manifest/关键分包与素材 SHA-256 与本地 dist 一致，线上 sw.js 预缓存
  102 项。发布后已推送 GitHub。

- 2026-09-19 仅更新协作政策，未发布：统一为默认本地提交、推送与部署分别授权；
  测试按影响范围分层，发布复用有效的最终代码验收结果，消除每次编辑/提交重复全量要求。

- 2026-09-19 发布 `967fb4a`（1 个提交）：375×667 全量 24 款逐张目视审计收尾——
  纸牌三款竖屏方向提示改到屏幕顶部留白区（原 116px 定位会压牌桌）；五子棋新增
  棋盘缩放（DOM 钉屏 ＋/− 四档 + 真机双指捏合 + 放大后拖动平移 + 拖动>12px 不落子
  + worldX 落子坐标），解决手机格子仅 22px 无法精确落子；其余 19 款审计达标。
  验证：缩放/落子/平移事件级验证、225 测试全绿、回归全绿、100 产物哈希一致。
  发布后已推送 GitHub。
- 2026-09-19 发布 `b224ce0`（1 个提交）：修复真机手机三类问题——LegacyChrome 窄屏
  （<560）标题靠左+工具图标化解决顶栏挤压重叠；host-backdrop 新增整屏同图 cover
  模式接入停车场/泡泡龙/合成水果/切水果四款、.game-host 默认米色底解决背景不撑满
  与 letterbox 异色；帮助面板重写自适应（视口收窄、按行数计高、超高 dense 压缩、
  resize 整体重建、进场改 fade）解决首弹乱跑闪烁与窄屏溢出。验证：375×667 十款
  复现对照逐项通过、纸牌最长文案窄屏+旋转完整、225 测试全绿、回归全绿、100 产物
  哈希一致、线上俄罗斯方块 375 实测顶栏正常零错误。发布后已推送 GitHub。
- 2026-09-19 发布 `101203e`（1 个提交）：接入 v3 batch 3 programmatic 收尾批（九款，无新图
  片）——新增共享 LegacyChrome 顶栏（按包内 API 签名实现）与 SegmentControl 分段选择器；
  2048/五子棋/扫雷/俄罗斯方块自绘 header 迁共享 chrome；扫雷难度与五子棋模式切 segment
  （参数不变）；2048 tile 阴影、数织线索描边+五格分隔线、数独行列宫关联高亮、打地鼠
  程序化锤子、俄罗斯方块控制钮 60px。规则层零改动。验证：225 测试全绿、回归横竖屏
  全绿、手机 390 宽九款截图目视合格、100 个构建产物哈希一致、线上扫雷实测生效零错误；
  screenshots/ 全量重生成。发布后已推送 GitHub。
- 2026-09-19 发布 `f09ee85`（1 个提交）：接入 v3 clean assets batch 2 增量美术——
  迷宫探险三帧精灵（兔/小屋/胡萝卜提示，footprints 留作后续 trail）、合成水果与切水果
  厨房风背景（切水果同步移除程序化假木板避免双层）、经典纸牌独立大厅图标（保留既有
  三项不覆盖）、接水管/七巧板/解绳结三款程序化 polish（不引入贴图）。规则层零改动。
  验证：素材哈希 4/4、七款画面目视合格、回归横竖屏全绿、225 测试全绿、预缓存
  96→101 项、100 个构建产物 SHA-256 与本地一致、线上迷宫新精灵实测生效零错误；
  screenshots/ 全量重生成（60 张更新）。发布后已推送 GitHub。
- 2026-09-19 发布 `3ab3230`（1 个提交）：接入 games-product-v3-clean-assets 正式美术批次——
  停车场（背景等比 cover+4 帧车辆精灵仅替换 len=2+独立大厅图标）、记忆翻牌（两套 24 格
  真图集替换 emoji）、泡泡龙（五色精灵+背景）、推箱子（猫/箱/星/墙四帧）、纸牌三件套
  （4:3 木纹桌布+牌背），规则层零改动。工程适配：workbox 预缓存上限提至 4MiB（牌桌
  2.26MB 超默认 2MiB 曾致构建失败）；预缓存 84→96 项（约 +12.6MB，首次安装离线包
  变大）。验证：素材哈希 10/10 对包内清单、五组对局截图目视合格、回归横竖屏全绿、
  225 测试全绿、95 个构建产物 SHA-256 与本地一致、线上 memory 新图集实测生效零错误；
  screenshots/ 75 张全量重生成并随批推送。发布后已推送 GitHub。
- 2026-09-19 发布 `b9d3a92`（1 个提交）：全部 24 款游戏接入玩法说明系统——共享面板组件
  （emoji+目标句+步骤+贴士，遮罩点击关闭）+ 集中文案注册表；首次进入自动弹一次
  （localStorage family-game-room-help-seen-v1），顶栏"?"随时重开；PuzzleScene 一处
  覆盖 14 款、动作系仅"?"不首弹、10 款独立场景分别接入，俄罗斯方块首弹期间暂停下落。
  修复帮助遮罩中心原点 hitArea 左上半屏点不到的问题；回归脚本预置 seen 防首弹吞输入。
  验证：八款代表五种接入形态全链路通过（首弹/遮罩关闭/"?"/seen 标记）、browser-smoke
  横竖屏两轮全绿、225 测试全绿；线上清 SW 后水排序首弹成功、浏览器错误 0；84 个构建
  产物 SHA-256 与本地 dist 一致。发布后已推送 GitHub。
- 2026-09-18 发布 `7e3bd91`（1 个提交）：修复线上叠叠消/水排序图标全部空白——Phosphor
  SVG 只有 viewBox 无显式宽高，Phaser SVGFile 不传 svgConfig 时光栅化得 0×0 Image，
  WebGL 报 texImage2D bad image data；preloadGameUi 改传 {width:256,height:256}。
  之前验证只监听 console 域而该错误走浏览器 Log 域，dev 下同样坏但漏检。回归脚本
  同步修三处被掩盖的时序缺陷：水排序倒水改轮询 busy/moves（跨排动画约 1s）、
  tile-match 按场景实际逻辑高换算点击（portrait-fluid 下 /900 换算 y 偏 13.8%）、
  parking 段开新局前清 draft 并等 carViews 就绪。验证：preview 与线上（清 SW 后）
  bad image data 均 0 条、截图逐按钮确认 glyph；browser-smoke 连续两次全绿
  （监听器 55→55）；84 个构建产物 SHA-256 与本地 dist 一致。发布后已推送 GitHub。
- 2026-09-18 发布 `ff06935`（1 个提交）：共享 UI Foundation（game-ui-foundation-v1）——
  新增 src/ui（设计 tokens、Phosphor Bold 图标语义映射、七个 Phaser 组件：
  icon-button/tool-button/mode-selector/stat-chip/top-bar/toast/dialog），叠叠消与
  水排序的 cozy-ui.ts 收敛为兼容 bridge，art.ts 预加载共享图标；新增依赖
  @phosphor-icons/core 2.1.1（构建时打包，无 CDN 请求）。集成修复 Phaser 4
  XHRLoader 对 data: URI 强制 base64 解码导致的图标加载崩溃（?raw 内联 + base64
  dataURI）。225 测试全绿、browser-smoke 横竖屏回归跑绿（期间定位到改 icons.ts
  后需重启 dev 服务，否则 HMR 模块分叉使回归 hook 失效）、并排截图确认两款视觉
  一致；84 个构建产物 SHA-256 与本地 dist 一致（本地 dist 内 .DS_Store 为
  Finder 垃圾文件，glob 不上传属预期）。发布后已推送 GitHub。
- 2026-09-18 发布 `5e9999f`（1 个提交）：水排序垂直切片 v1——core 重写（打散+
  solvePath 求解验证+解路径长度难度带，两根空瓶，安全固定 fallback 替代丢液体的
  旧修补式）、独立 Cozy UI 场景与 portrait-fluid mount（手机全屏）、持久试管
  视图+真实水流逐层转移+非法摇动保持选中、solvePath 首手提示、6 个 WAV 音效、
  木桌 jpg 背景与独立大厅图标。集成修正五处 hitArea（Phaser 4 displayOrigin）、
  jpg 预缓存、回归脚本适配。同日早前发布 `b4e12e6`：叠叠消 v3——构造式多层
  生成器（3/5/6 层，()=>0 不退化，去掉 layer*0.34 斜飘）+ 移动端 UI 收敛
  （控制簇/收集 N/7/中文工具胶囊/档位点）。两项均 225 测试全绿、回归跑绿、
  CDP 验收通过；83 个构建文件 SHA-256 一致。发布后已推送 GitHub。
- 2026-09-18 发布 `5209b89`（1 个提交）：叠叠消 Mobile Polish v2——独立 portrait-fluid
  mount（逻辑高随宿主纵横比 960~1720 自适应，消除手机上下约 400px letterbox）、
  Cozy UI 设计语言（森林绿/奶油/蜂蜜金、线性图标、数量徽章、厚托盘金边、
  胜利卡同体系）、独立 PNG 大厅图标＋ui-tap 音效。集成修正五处中心对称 hitArea
  （Phaser 4 displayOrigin 语义）与 icon-art 合并笔误。四尺寸视口实测全满宿主、
  实玩通关/再玩/退出通过；222 项测试全绿、回归跑绿；74 文件 SHA-256 一致。
  发布后已推送 GitHub。
- 2026-09-18 发布 `363c7f6`（1 个提交）：叠叠消接入 GPT 重构的「产品级纵切」——
  独立场景（不再继承 PuzzleScene 外壳）、主玩法持久 TileView 零整盘重建、十种
  水果精灵全量覆盖＋五个触感 WAV 音效、胜利结算卡。集成修正：Phaser 4 Container
  displayOrigin 致中心对称 hitArea 只剩单像素可点（四处改 [0,size] 坐标）、wav
  补入预缓存 globPatterns、回归脚本 tile-match 段适配独立场景。core 规则未动；
  222 项测试全绿、正式回归跑绿、CDP 真机全流程验玩（拾取/凑三/槽满/撤销/洗牌/
  重开/难度/静音/胜利重玩/退出）。73 个构建文件 SHA-256 全部一致；/audio/ 走
  7 天默认缓存（素材内容不变，可接受）。发布后已推送 GitHub。
- 2026-09-18 发布 `5692ddf`（9 个提交）：全量 UI 截图审计与修整（codex 执行，
  审计报告 docs/reviews/2026-09-18-ui-audit.md，前后对照页存 test-results/ui-audit）——
  大厅图标放大与卡片阴影柔化、老游戏头部控件圆角化、水排序水层对齐与背景比例
  保持、数织线索分组贴格、接水管对比度与水高光、记忆卡居中、俄罗斯方块预览
  与横屏控件重叠修复、游戏控件与美术可读性改进；正式回归脚本扩充（55 行新增）。
  222 项测试全绿、完整交互回归与 Retina 检查通过；发版后 HTTP 301→HTTPS、证书
  （至 2026-12-14）、no-cache 缓存头正常，66 个构建文件 SHA-256 全部一致。
- 2026-09-18 发布 `819ccf2`（1 个提交）：水排序难度与液体双重做——空管 2→1、生成改
  随机洗牌+完备 DFS 复核（实测贪心解 9/16/20 步、挑战档需回溯）；液体渲染改连续
  液柱+弯月面+反光带（去格子感）；回归脚本改读真实试管位置。产品行为变更：
  新难度梯度与旧版不同（旧档按原局面续玩）。222 项测试全绿、回归跑绿、66 文件
  SHA-256 一致。
- 2026-09-18 发布 `b413b16`（1 个提交）：UI 升级第三批——点泡泡/红包雨/叠叠消接入
  用户生成的六张素材（精灵表+背景各一，原为用户直传服务器根目录的 ChatGPT 图，
  拉回 public/art 规范归位；服务器根目录 6 张原图按规范保留未动）。背景沿用等比
  cover 防变形模式，实体换精灵帧，素材缺失退回程序化；叠叠消素材未覆盖的四种
  水果保留 emoji 保证同款可辨。221 项测试全绿、回归跑绿、CDP 三款验收通过；
  66 个构建文件 SHA-256 一致。
- 2026-09-18 发布 `1b50e31`（1 个提交）：修复水排序/打地鼠背景图非等比硬拉变形
  （941×1672 压缩 34%）与试管显示比例偏差——背景改等比 cover 铺满（超画布自动
  裁剪），试管宽度按素材严格纵横比推导。221 项测试全绿、回归跑绿、截图复核
  比例自然。60 个构建文件 SHA-256 一致；另发现服务器根目录有 6 张用户手动
  上传的 ChatGPT 生成图（非本次构建产物，不属部署范围，未动）。
- 2026-09-18 发布 `cb2e0ec`（1 个提交）：多端适配——画布 letterbox 区域用游戏背景
  cover 铺满（画布内不变形，host-backdrop 助手 + SHUTDOWN/DESTROY 释放），手机
  ≤560px 大厅两列，四款新游戏兜底图标升级圆角徽章风；修复 water-sort 缺 Phaser
  import 导致场景创建即崩（正式回归抓到）。221 项测试全绿，回归跑绿，三端 CDP
  实测通过。自此确立默认工作流：提交→推送→部署（AGENTS.md 同步）。59 文件
  SHA-256 全部一致。
- 2026-09-18 发布 `e33ba69`（1 个提交）：水排序 UI 升级第二批——接入玻璃管身/
  透明高光覆盖/木桌台面背景三张素材（1.4MB，方形生成图按管区裁切 132×407 与
  显示比例严格一致），渲染次序背景→管身→程序色水层→高光→选中描边，素材缺失
  退回程序化绘制。221 项测试全绿，正式回归跑绿，CDP 视觉验收玻璃质感、水层
  可读、倒水正常。发版后 HTTPS 200、素材可达，59 个构建文件 SHA-256 全部
  一致。发布后已推送 GitHub。
- 2026-09-18 发布 `1065e96`（2 个提交）：打地鼠 UI 升级第一批——接入 gpt-image-2.5
  生成的三张素材（四态地鼠精灵表/立体土丘洞/草地背景，1.9MB，提示词见
  docs/art-prompts.md），背景全局垫底、洞与地鼠换精灵、新增打中晕头/打错惊醒
  定格帧，素材缺失退回程序化绘制；另含 iOS 长按画布呼出菜单修复（touch-callout
  none）。221 项测试全绿，正式浏览器回归跑绿，CDP 视觉验收钻洞遮挡自然。发版后
  验证 HTTPS 200、证书（至 2026-12-14）、素材 immutable 缓存头正常；56 个构建
  文件 SHA-256 全部一致，预缓存 8.4→10.3MB。发布后已推送 GitHub。
- 2026-09-18 发布 `16360cc`（3 个提交）：两轮 codex 独立验收退回的全部修复——一轮 A1~A6
  （数织旧档身份、纸牌拖动跟手、停车场输入锁、监听器累积、内容入口、回归脚本），二轮
  R1~R3（纸牌轻点移动、数织三代编号兼容含交错版精确映射与一次性备份、推箱子选关末排
  越界）及 browser-smoke 卡片级等待稳定性修复。测试 215→221；正式 pnpm test:browser
  完整跑绿；每项修复均有 CDP 专项证据。发布后验证 HTTP 301→HTTPS、HTTPS 200、证书
  （SAN 三域名，至 2026-12-14）、no-cache/immutable 缓存头正常；本地 dist 53 个构建
  文件在服务器上 SHA-256 全部一致。发布后已推送 GitHub。iPad 真机与孩子 Playtest
  仍待安排。
- 2026-09-17 发布 `c4fb94e`（1 个提交）：Phase 1/2 稳定化收口（线上审查结论
  docs/EXPERIENCE-2-PHASE-1-2-STABILIZATION.md）——数织大厅总数从写死 9 改为
  PATTERNS.length 唯一来源、推箱子从写死 <10 改为 LEVELS.length（第 11~30 关
  计入、越界 key 过滤）、FreeCell 基础堆顶牌移除拖动源（规则不支持取回）；
  EXPERIENCE-2 看板/迁移矩阵/Changelog 对齐。测试 213→215，CDP 实测大厅进度
  与 FreeCell 五种拖动路径/undo/foundation 不可拖。发布后验证 HTTP 301→HTTPS、
  证书（至 2026-12-14）、no-cache 缓存头正常；53 个构建文件 SHA-256 全部一致。
  发布后已推送 GitHub。Experience 2.0 新功能开发停止，等待真实玩家 Playtest。
- 2026-09-17 发布 `8b60fd4`（18 个提交）：Experience 2.0 两个阶段全量落地——
  纸牌三款拖牌、水排序/七巧板拿起反馈、2048/记忆/扫雷触觉增强、动作三款
  保留背景结算卡、数织 9→50 幅（双射变体保唯一解）、推箱子 10→30 关
  （固定种子生成+BFS 验证）、五子棋胜利连线动画；此前批次含停车场单指拖车、
  合成水果连锁反馈、切水果玩具柜 intro 与 HUD、Home 2.0 儿童大厅、小树成长、
  纸牌存档/取消/回收三问题修复。测试基线 192→213（36→38 文件），每个批次
  均经 CDP 真实操作验收。发布后验证 HTTP 301→HTTPS、HTTPS 200、证书
  （SAN 三域名，至 2026-12-14）、no-cache/immutable 缓存头正常；本地 dist
  53 个构建文件在服务器上 SHA-256 全部一致（历史 hash 分包为多次发版残留，
  按规范不清理）。未推送 Git；iPad Safari 真机与孩子 Playtest 待用户安排。
- 2026-09-17 发布 `83e4d0e`（5 个提交）：新增纸牌（Klondike 翻一模式，82-92% 可解、
  安全自动收尾、IndexedDB 续档）并修复 codex 验收的三个问题——回收过牌后重进
  重新发牌（存档校验漏算基础堆张数，改用 core reviveState 完整校验）、选中废牌
  无法取消且点其他列被旧选中困住（再点取消+移动失败自动改选）、选中多张点回收
  区仍收走末尾一张（回收前拦截并提示）。测试基线 182→192（36 文件）；三问题均
  经 CDP 实机复现验证（预置含回收 A 存档重进续档、废牌两次点击取消高亮、
  黑7红6 两张选中点基础堆被拦截不收牌）。发布后验证 HTTP 301→HTTPS、
  HTTPS 200、证书（SAN 三域名，至 2026-12-14）、no-cache/immutable 缓存头正常；
  本地 dist 51 个构建文件在服务器上 SHA-256 全部一致（服务器积累的历史 hash
  分包 298 个为多次发版残留，按规范不清理）。未推送 Git。
- 2026-09-17 发布 `c311448`（4 个提交）：修复叠叠消满槽洗牌无法继续（未消除槽牌
  先回场再洗，可解验证遵守满槽禁取）、停车场车辆半格偏移及挑战档两步兜底、
  水排序第六色缺失与旧四色/五色 v1 存档不兼容。停车场随机出题限制搜索预算，
  使用 BFS 验证的 5/8/17 步同档备用题。182 项测试、完整 DPR=2 横竖屏交互回归、
  Retina 八类画布回归和生产包离线重开通过；监听器断言修正为“不增长”。
  发布后 HTTP 301→HTTPS、HTTPS 200、证书（至 2026-12-14）、缓存头正常；服务器
  50 个公开构建文件 SHA-256 全部匹配，本次入口/SW/manifest/三游戏及存档分包另经
  HTTPS 下载逐一匹配。首次线上测试受慢网络触发 10 秒超时，延长等待后线上三款游戏
  横竖屏、SW 接管及离线重开通过（报告 `games-browser-report-uH0dBv`）。
  未推送 Git；iPad Safari 真机听感及已安装 PWA 的更新提示仍需用户设备确认。
- 2026-09-17 发布 `68ad8fb`（6 个提交）：修复四个线上反馈问题——大厅图标
  由洪水填充去白改为统一圆角徽章（纸牌白色牌面曾被描边断开处挖穿）、
  停车场车辆间隙加大到 20px+、水排序难度拉开为 3/5/6 色、叠叠消堆叠区
  约束在按钮与槽位之间的安全带（不再越界压顶）。发布前完成全量自查：
  23 款游戏逐一 CDP 实测零运行时错误、拼图视觉审查、browser-smoke
  全量与 RENDER_ONLY Retina 回归、大厅编辑模式验证，测试基线 179。
  发版后验证 HTTP 301/缓存头/证书正常，50 个构建文件 SHA-256 与本地
  dist 全部一致。
- 2026-09-17 发布 `30c8c2b`（7 个提交）：新增三款益智游戏——水排序（反向打散
  生成必可解、颜色+符号双标识、续玩存档）、停车场（Rush Hour 滑车解谜、BFS
  步数带生成与最少步数提示、续玩存档）、叠叠消（儿童版三消叠块、槽满不清盘
  提供免费撤销/洗牌）；测试基线 162→179（35 文件），AGENTS/README 同步，
  提示词文档新增 lobby-e.png（3×1）待生成；三款均经 CDP 浏览器实测
  （点选交互、生成正确性、无渲染错误）。发版后验证 HTTP 301/缓存头/证书
  正常，50 个构建文件 SHA-256 与本地 dist 全部一致。
- 2026-09-17 发布 `4352064`（3 个提交）：大厅 20 个游戏图标全部替换为生成的
  卡通精灵图（art/lobby-a~d.png，四张共 20 格，按官方 gpt-image-2.5 指南
  生成）；新增 src/app/icon-art.ts 管线——加载精灵图后边缘洪水填充去白底、
  逐格按内容裁剪居中 128px dataURL 替换 SVG，素材缺失时 SVG 兜底；
  提示词文档重写为官方指南版并只保留图标管线。发布前像素+内容逐格验收
  （网格干净无跨格、内容对应无错位），CDP DPR=2 实测 20 卡全替换零残留；
  发版后验证 HTTP 301/缓存头/证书正常，47 个构建文件（含 4 张精灵图）
  SHA-256 与本地 dist 全部一致。
- 2026-09-17 发布 `d2ac750`（1 个提交）：修复合成水果碰撞失效——素材接入后
  spawnFruit 先按旧纹理常量 setCircle 再 setDisplaySize，显示缩放联动把刚体缩成
  质量 0 的退化圆，水果互相穿透且不触发 collisionstart 合并；改为先
  setDisplaySize 再以 core 规则半径 setCircle 收尾。CDP 实测 DPR=1/2 各投 9 颗：
  正常堆叠无穿模、多次合成得分；发版后验证 HTTP 301/缓存头/证书正常，
  43 个构建文件 SHA-256 与本地 dist 全部一致。
- 2026-09-17 发布 `9e785e6`（5 个提交）：全部游戏按设备像素密度渲染（enableHighDpi，
  DPR 上限 2、总像素 ≤4M）解决 Retina 发虚；四款动作游戏提速为基础/进阶/挑战并
  渐进加速，最高分按难度分档（`family-game-room-<id>-v2-best-<mode>`，旧成绩标
  「旧节奏」）；益智游戏起步难度抬高（记忆 12 对、接水管 4×4、解绳结 6 点、
  迷宫 7×7、数独 6×6、泡泡龙 4/5 色、推箱子选关列 PAR≥8 挑战关）并新增迷宫
  按住拖动（dragAlong 逐格插值）；测试基线 155→162。发布前 `RENDER_ONLY=1`
  Retina 冒烟（8 游戏 × 横竖屏 DPR=2 断言）通过；发版后验证 HTTP 301→HTTPS、
  缓存头、证书（SAN 三域名，至 2026-12-14）正常，43 个公开构建文件 SHA-256
  与本地 dist 全部一致。
- 2026-09-17 发布 `1d1ef2f`（5 个提交）：统一 20 款大厅 SVG 图标，改善泡泡/红包美术、
  音效声源限制和释放、动作游戏粒子池与重玩清理；切水果新增木质背景、跟手刀光、
  果肉半果飞散及整次挥刀连切计分。发布前 `pnpm check` 通过 30 文件 155 测试。
  发布后 HTTP 301→HTTPS、HTTPS 200、证书 SAN/有效期、入口/SW/manifest 缓存头正常；
  43 个公开构建文件 SHA-256 与本地 dist 全部一致（不计 Finder 隐藏元数据）。
  线上 Chrome 768×1024 与 1024×768 大厅及切水果启动冒烟通过；iPad 主屏幕更新仍待真机确认。

- 2026-09-15 首次上线：build + scp 到 /home/www/games，nginx HTTPS + PWA 缓存策略，
  Let's Encrypt 自动续期（当时仅 games 域名）。
- 2026-09-15 应要求切换为手动腾讯云证书；同日切回 Let's Encrypt 自动续期，
  一张 SAN 证书覆盖 dreamser.com + games.dreamser.com，certbot.timer 修复并 dry-run 验证。
- 2026-09-16 DNSPod 补 www 解析，证书 SAN 扩展为三域名；www 502 事件闭环。
- 2026-09-16 发布 UX 批量修复（存档超时兜底、触屏文案、底部安全区、五子棋
  分段按钮与比分、44px 头部药丸、蜘蛛发牌堆排布、大厅横屏居中、蜘蛛头部
  重叠修复），覆盖空当接龙编号局与蜘蛛发牌动画；发版后验证 HTTPS/证书/
  缓存头正常，线上 sw.js、workbox 与游戏分包哈希均与本地 dist 一致。
- 2026-09-16 发布触控体验修复：俄罗斯方块按钮支持按住连续操作，空当接龙空列整列
  可点击，并在选择连续牌及超量移动失败时显示准确容量和“目标空列不算中转”的说明；
  发版后验证 7 个游戏可打开、无运行时错误，入口/PWA/游戏分包哈希与本地一致。
- 2026-09-16 发布八款新益智游戏（记忆翻牌/七巧板/接水管/推箱子/泡泡龙/解绳结/
  迷宫探险/数织，共 30 个提交，含 puzzle-kit 共享场景与 18 文件 95 测试基线）；
  发版后验证 HTTPS/缓存头/证书正常，线上 sw.js、workbox、index 与全部新游戏
  分包 SHA-256 均与本地 dist 一致，大厅与记忆翻牌、推箱子冒烟截图正常。
- 2026-09-16 发布难度扩展（面向 8 岁孩子）：记忆翻牌 8/16/24 对、推箱子 5→10 关、
  解绳结 5-9 点、迷宫至 11×11、接水管至 6×6、泡泡龙新增四色挑战模式，
  7 个提交，测试基线 95→97；发版后验证 HTTPS/缓存头/证书正常，线上 sw.js、
  workbox、index 与六个改动游戏分包 SHA-256 均与本地 dist 一致。
- 2026-09-16 发布进度与玩法扩展：新增数独（4×4/6×6/9×9 唯一解生成）、益智游戏
  跨会话进度与最好成绩（game-puzzle-progress-v1，大厅卡片展示）、数织 10×10 四幅、
  推箱子选关与三星评级、七巧板剪影挑战模式，8 个提交，测试基线 97→105
  （19 文件）；发版后验证 HTTPS/缓存头/证书正常，线上 sw.js、workbox、index、
  数独分包及四个改动游戏分包 SHA-256 均与本地 dist 一致。
- 2026-09-16 发布四款动作游戏（点泡泡/红包雨/打地鼠/切水果，含 action-kit 逐帧
  场景骨架与 WebAudio 噪声爆裂音效），10 个提交，测试基线 105→145（28 文件）；
  CDP 全回合验收含计时探针（回合时间线性流动、时间到结算、最高分入大厅卡片）；
  发版后验证 HTTPS 301/缓存头/证书（SAN 三域名，至 2026-12-14）正常，线上
  sw.js、index、manifest 与四款新游戏分包 SHA-256 均与本地 dist 一致。
- 2026-09-16 发布六项体验修复与改版：红包点击特效合并、切水果遮罩裂开两半加
  闪亮粒子、泡泡与红包放大、合成水果各级专属纹路、空当接龙残局自动收完、
  大厅改版桌面式图标网格并支持「整理图标」拖拽排序（新增顺序存储键
  family-game-room-order-v1），8 个提交，测试基线 145→147；发版后验证
  HTTPS/缓存头/证书正常，线上 index、sw.js、样式与六个改动游戏分包
  SHA-256 均与本地 dist 一致。
- 2026-09-17 发布 AI 素材接入与切面绘制：合成水果与切水果启用生成的整果精灵图
  （art/fruits-small/big.png，洪水填充去白底+逐帧裁剪居中），大厅卡片去除
  「开始游戏」默认文案并修复整理图标拖拽时的文本选中；切水果半果切口程序化
  绘制皮边+果肉+籽切面（第六种飞行水果葡萄→菠萝，果汁颜色对齐果色）；
  8 个提交（4 个影响产物）；发版后验证 HTTPS 301/缓存头/证书（SAN 三域名，
  至 2026-12-14）正常，线上 index、sw.js、workbox、两个游戏分包、两张素材图
  共 8 项 SHA-256 均与本地 dist 一致。
