# IMPACTONE V3.3

本版以用户确认的手机长图样本为最高视觉基准，排版规范仅作补充。

## 本版重点修复
- IMPACTONE Footer Logo 已去除矩形深蓝背景并裁切为透明 PNG。
- 底部 `订阅 / 转发 / 收藏 / 评论` 改为真正的 `position: fixed` 常驻工具栏，手机滚动时始终显示。
- 关闭状态的评论面板完全隐藏，不再在页面底部露出“评论”标题遮住工具栏。
- 今日扫描改用 HTML 原生 `<details>` 折叠：默认只显示编号、标题、快评；点击“展开内容 +”后才显示事件正文，因此即使 JavaScript 加载失败也能正常展开/收起。
- 保留订阅、系统分享/社媒分享、收藏、评论及 Supabase/Resend 对接结构。
- 封面 Skyline 调整为更接近样本的纽约城市线稿，并强化 Empire State Building 识别。

测试仍上传至 `daily-v2-test`，确认无误后再合并 main。
