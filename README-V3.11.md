# IMPACTONE V3.11

本版集中修正 V3.10 测试反馈：

1. Skyline：继续使用用户提供的原始透明天际线。移动端保持原比例；桌面端整体缩放而非拉伸/裁切，避免帝国大厦消失。
2. 分享：微信与“更多”使用系统分享；WhatsApp 直达分享；LinkedIn 直达 Post；Facebook 使用官方网页分享器；Instagram 与小红书尝试直接唤起发布入口，并先复制当前文章链接供粘贴。测试站分享当前 Vercel Preview URL。
3. 订阅：删除未配置的微信/小红书/Instagram“关注”摆设。订阅弹窗以“添加到手机桌面/PWA”为主，邮件订阅仅作为备用。
4. PWA：增加 manifest.webmanifest、service-worker.js，以及 IMPACTONE 192/512 图标。Android/Chrome 可使用安装提示；iPhone Safari 按“分享 → 添加到主屏幕”。
5. 收藏、评论、Daily Scan 折叠、字号设置和正文结构保持不变。

说明：Instagram/小红书普通网页没有与 WhatsApp 同等级的公开标准“带网页链接直达指定发布页”接口。本版采用 App deep link + 自动复制文章链接；如果系统或 App 阻止 deep link，会回退到平台网页。
