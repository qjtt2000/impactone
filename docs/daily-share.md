# 每日必读分享卡片

全球版和纽约版在发布当天 HTML 前运行：

```sh
python -m pip install Pillow
python scripts/prepare-daily-share.py daily/YYYY-MM-DD.html daily/YYYY-MM-DD-ny.html
```

脚本从各版第一条焦点新闻提取配图，生成 600×600 JPEG 缩略图，并用前三条焦点新闻标题生成卡片摘要。提交两版 HTML 和新生成的两张 JPEG。发布后检查正式网页与缩略图，使用当期链接查看微信收件端卡片。企业微信后台若单独设置了封面或摘要，也使用当期图片和标题。
