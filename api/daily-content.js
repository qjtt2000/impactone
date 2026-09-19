export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    })
  }

  try {
    // =====================================================
    // 1. 获取 GitHub daily 文件夹
    // =====================================================

    const githubApiUrl =
      'https://api.github.com/repos/qjtt2000/impactone/contents/daily'

    const listResponse = await fetch(githubApiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'IMPACTONE'
      }
    })

    if (!listResponse.ok) {
      const detail = await listResponse.text()

      console.error(
        'Failed to load daily folder:',
        listResponse.status,
        detail
      )

      return res.status(500).json({
        success: false,
        error: 'Failed to load daily issues'
      })
    }

    const files = await listResponse.json()

    if (!Array.isArray(files)) {
      return res.status(500).json({
        success: false,
        error: 'Invalid GitHub response'
      })
    }

    // =====================================================
    // 2. 找最新一期 YYYY-MM-DD.html
    // =====================================================

    const dailyFiles = files
      .filter(item =>
        /^\d{4}-\d{2}-\d{2}\.html$/.test(item.name)
      )
      .sort((a, b) =>
        b.name.localeCompare(a.name)
      )

    if (dailyFiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No daily issue found'
      })
    }

    const latest = dailyFiles[0]

    const date =
      latest.name.replace('.html', '')

    // =====================================================
    // 3. 读取最新一期 HTML
    // =====================================================

    const rawUrl =
      `https://raw.githubusercontent.com/qjtt2000/impactone/main/daily/${latest.name}`

    const htmlResponse = await fetch(rawUrl)

    if (!htmlResponse.ok) {
      const detail = await htmlResponse.text()

      console.error(
        'Failed to load daily HTML:',
        htmlResponse.status,
        detail
      )

      return res.status(500).json({
        success: false,
        error: 'Failed to load latest daily content'
      })
    }

    const html = await htmlResponse.text()

    // =====================================================
    // 4. HTML 工具函数
    // =====================================================

    function decodeHtml(text = '') {
      return text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#(\d+);/g, (_, code) =>
          String.fromCharCode(Number(code))
        )
        .trim()
    }

    function cleanText(text = '') {
      return decodeHtml(
        text
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\r/g, '')
          .replace(/\n[ \t]+/g, '\n')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
      )
    }

    function getFirstMatch(regex, source) {
      const match = source.match(regex)

      return match
        ? cleanText(match[1])
        : ''
    }

    // =====================================================
    // 5. 提取刊期基本信息
    // =====================================================

    const title =
      getFirstMatch(
        /<title[^>]*>([\s\S]*?)<\/title>/i,
        html
      ) || '影响力·每日必读'

    const issueDate =
      getFirstMatch(
        /<div[^>]*class=["'][^"']*date[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        html
      ) || date.replace(/-/g, '/')

    // =====================================================
    // 6. 提取主要文章
    // =====================================================

    const stories = []

    const articleRegex =
      /<article\b[^>]*class=["'][^"']*story[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi

    let articleMatch

    while (
      (articleMatch = articleRegex.exec(html)) !== null
    ) {
      const articleHtml = articleMatch[1]

      const storyTitle =
        getFirstMatch(
          /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i,
          articleHtml
        )

      const paragraphs = []

      const paragraphRegex =
        /<p\b[^>]*>([\s\S]*?)<\/p>/gi

      let paragraphMatch

      while (
        (paragraphMatch =
          paragraphRegex.exec(articleHtml)) !== null
      ) {
        const text =
          cleanText(paragraphMatch[1])

        if (text) {
          paragraphs.push(text)
        }
      }

      const source =
        getFirstMatch(
          /<[^>]*class=["'][^"']*source[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
          articleHtml
        )

      if (
        storyTitle ||
        paragraphs.length > 0
      ) {
        stories.push({
          title: storyTitle,
          paragraphs,
          source
        })
      }
    }

    // =====================================================
    // 7. 返回给小程序
    // =====================================================

    return res.status(200).json({
      success: true,

      issue: {
        date,
        displayDate: issueDate,
        file: latest.name,
        title,
        webUrl:
          `https://www.impactone.news/daily/${latest.name}`
      },

      stories,

      storyCount: stories.length
    })

  } catch (error) {
    console.error(
      'daily-content error:',
      error
    )

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
