# games（小树游戏屋）

给女儿在 iPad 上玩的离线 PWA 游戏大厅（2048 / 合成水果 / 俄罗斯方块 / 五子棋 /
蜘蛛纸牌 / 空当接龙 / 扫雷等），无广告、无后端、纯静态。

## 开发

- 技术栈：TypeScript + Vite + Phaser 4 + vite-plugin-pwa（prompt 更新模式）。
- 每个游戏分两层：纯规则 `core`（不依赖 Phaser/DOM，可单测）+ 显示层 `scene`。
- 提交前跑 `pnpm check`（类型检查 + 单测 + 构建）。

## 发版与运维（入口索引）

**任何部署 / nginx / 证书 / 排障操作，先读 [docs/ops.md](docs/ops.md)**，要点速查：

| 事项 | 入口 |
| --- | --- |
| 发版（唯一方式） | `pnpm run deploy`（本地 build + scp 到服务器 /home/www/games） |
| 运维手册全文 | [docs/ops.md](docs/ops.md)（架构、nginx 缓存策略、证书续期、排障案例） |
| 服务器 | `ssh -p 1991 ubuntu@101.42.50.27`，nginx 配置在 /etc/nginx/conf.d/ |
| 域名 | games.dreamser.com（证书与主站共用一张 Let's Encrypt SAN 证书，自动续期） |

## 铁律

- 改动只在本地做；**严禁在服务器上直接改 /home/www/games 或 nginx 配置以外的项目文件**
  （nginx/证书的变更也必须：先备份 → 改 → `nginx -t` → `systemctl reload nginx`）。
- 不要 apt 安装/卸载 certbot（会 mask 续期 timer）；certbot 是 /opt/certbot 的 venv 版。
- nginx 里 `sw.js`、`manifest.webmanifest`、`index.html` 的 no-cache 策略是 PWA
  更新链路的生命线，重构配置时不得丢失（原因见 ops.md 第 3 节）。
- 证书自动续期依赖 DNS 指向 + 80 端口可达，动防火墙/IP 前先看 ops.md 第 4 节。

## 提交规范

commit message 三要素：原因（为什么改）/ 内容（改了什么）/ 效果（验证结果）；
禁止 `fix bug` / `update` 等无信息量 message。
