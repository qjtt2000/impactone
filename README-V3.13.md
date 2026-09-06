# IMPACTONE V3.13

本版更新“订阅 = 添加到手机桌面 + 通知授权”的前端流程。

- iPhone/iPad 和 Android 安装说明始终同时显示。
- Android/Chromium：安装 PWA 后尽可能在同一用户操作链中请求通知权限。
- iPhone/iPad：Safari 先“添加到主屏幕”；从桌面打开后，点底部“订阅”即触发系统通知授权，不再增加独立的“开启提醒”按钮。
- Service Worker 已加入 `push` 和 `notificationclick` 处理；点击通知可回到《每日必读》。
- `impactone-config.js` 新增 `pushSubscribeEndpoint` / `pushUnsubscribeEndpoint` / `vapidPublicKey` 预留项。
- 正式“每日自动推送”仍需后续部署 Push 后台并配置 VAPID；在未配置后台时，本版只完成系统通知权限与本地确认通知。
- Service Worker 缓存版本升级为 `impactone-daily-v313`，并将 HTML/JS/CSS/manifest 改为 network-first，避免手机继续读取旧版本缓存。
