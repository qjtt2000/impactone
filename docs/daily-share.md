# 每日必读分享卡片

发布当天 HTML 前运行：

```sh
python scripts/prepare-daily-share.py daily/YYYY-MM-DD.html daily/YYYY-MM-DD-ny.html
```

脚本用当期四条 DAILY FOCUS 标题按最终顺序生成 description、og:description、twitter:description，用焦点一媒体照片生成600×600 JPEG缩略图。提交两版正文HTML和两张JPEG，正文内容、品牌排头图与听新闻功能保持原有版式。

所有分享按钮、复制链接和企业微信群发卡片的目标地址均使用正文 canonical 地址 /daily/YYYY-MM-DD[-ny].html，点击直接阅读全文。不得新增需要再次点击“阅读全文”的分享中间页。旧 /share/ 地址由 vercel.json 自动重定向到对应正文。

封面和摘要是卡片信息，目标URL是全文地址，分别设置即可。企业微信群发助手如提供独立标题、摘要、封面、链接字段，使用当期标题、四条焦点摘要、焦点一图片、正文URL。网页元信息配置正确不能保证所有客户端抓取及缓存立即一致；未实际看到收件端卡片不得声称企微客户端已通过实测，不能为改善抓取而增加读者点击步骤。
