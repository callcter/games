# 小树游戏屋

一个为 iPad 设计、没有广告且支持离线运行的家庭小游戏 PWA。

目前可以玩：

- 2048（触摸滑动或使用方向键，自动保存进度）

## 本地开发

```bash
pnpm install
pnpm dev --host
```

电脑和 iPad 连接同一个局域网后，可以在 iPad Safari 中打开终端显示的网络地址进行真机调试。

## 检查与构建

```bash
pnpm check
pnpm preview
```

生产文件输出到 `dist/`，应部署到支持 HTTPS 的静态网站服务。
