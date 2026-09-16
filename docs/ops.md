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
- 提交前跑 `pnpm check`（类型检查 + 单测 + 构建）。
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
