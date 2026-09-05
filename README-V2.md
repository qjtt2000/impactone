# IMPACTONE《影响力·每日必读》V2

本版本是在现有 GitHub Pages 仓库上直接完善，不改变原网站的 index / article / people / login / register 页面结构。

## V2 完成内容

- 视觉进一步按批准样本收紧：深蓝、香槟金、暖白、01｜、观察｜、快评｜。
- 封面、栏目条、今日洞见、Footer 的字号、间距和层级重新校准。
- 今日焦点保持完整展开。
- 今日扫描默认只显示「标题 + 快评」，正文点击「展开全文＋」后显示。
- 今日扫描编号自动承接今日焦点，例如焦点 01–04 后扫描自动 05–12。
- 小 / 中 / 大三档正文阅读字号，跨期刊记忆。
- 手机底部固定「订阅 / 转发 / 收藏 / 评论」栏；使用统一线性 SVG 图标。
- 微信环境转发给出右上角分享提示；其他手机优先调用系统 Share Sheet，桌面回退到复制链接。
- 评论底部抽屉、发布、回复、点赞、评论数量；支持接入远程 API。
- 订阅弹窗支持接入 Supabase Edge Function；未配置时仍可本机预览状态。
- 提供 Supabase subscribers / comments 数据表以及 subscribe / comments / send-daily Edge Function 示例。

## 主要文件

- `daily/2026-08-19.html`：当前示例期刊。
- `daily-template.html`：以后新一期复制/数据化时使用的固定模板。
- `daily-publication.css`：V2 排版系统。
- `daily-interactions.js`：折叠、字号、订阅、分享、收藏、评论。
- `impactone-config.js`：后端 API 地址配置。
- `supabase/schema.sql`：订阅与评论数据库表。
- `supabase/functions/subscribe/`：真实订阅接口。
- `supabase/functions/comments/`：评论读取/提交/点赞接口。
- `supabase/functions/send-daily/`：每日邮件推送接口骨架。

## 先预览，不接后台

直接把整个仓库上传 GitHub 即可。`impactone-config.js` 里的三个 endpoint 保持空字符串时：

- 折叠、字号、分享完全可用；
- 订阅/收藏/评论使用浏览器 localStorage 做前端预览；
- 不会把假数据写到服务器。

## 接入 Supabase 后

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 部署 `subscribe`、`comments`、`send-daily` 三个 Edge Functions。
3. 配置 Edge Function secrets：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM`，例如 `IMPACTONE <daily@impactone.news>`
   - `IMPACTONE_ADMIN_SECRET`
4. 将 `impactone-config.js` 改成类似：

```js
window.IMPACTONE_CONFIG = {
  subscribeEndpoint: "https://YOUR_PROJECT.supabase.co/functions/v1/subscribe",
  commentsEndpoint: "https://YOUR_PROJECT.supabase.co/functions/v1/comments",
  favoriteEndpoint: ""
};
```

5. 评论默认 `pending`。在 Supabase 后台把审核通过的评论 `status` 改为 `approved` 后，所有读者才能看到。

## 每日推送

发布新一期后，由后台/Cron 向 `send-daily` POST：

```json
{
  "subject": "影响力·每日必读｜2026年9月5日",
  "issueUrl": "https://www.impactone.news/daily/2026-09-05.html",
  "preview": "今天最值得关注的全球商业、科技与投资变化。",
  "headlines": ["标题1", "标题2", "标题3"]
}
```

请求头需带 `x-impactone-secret: <IMPACTONE_ADMIN_SECRET>`。

## 重要

正式上线邮件订阅前，建议再补充双重确认（double opt-in）、退订链接、退信处理和隐私政策。当前 V2 的后端代码是可部署的结构骨架，不能替代这些正式邮件合规流程。
Preview deployment test
