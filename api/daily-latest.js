export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    })
  }

  try {
    // 从 GitHub 获取 daily 文件夹内容
    const githubUrl =
      'https://api.github.com/repos/qjtt2000/impactone/contents/daily'

    const response = await fetch(githubUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'IMPACTONE'
      }
    })

    if (!response.ok) {
      const detail = await response.text()

      console.error(
        'GitHub daily folder request failed:',
        response.status,
        detail
      )

      return res.status(500).json({
        success: false,
        error: 'Failed to load daily issues'
      })
    }

    const files = await response.json()

    if (!Array.isArray(files)) {
      return res.status(500).json({
        success: false,
        error: 'Invalid GitHub response'
      })
    }

    // 只保留 YYYY-MM-DD.html
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

    const date = latest.name.replace('.html', '')

    return res.status(200).json({
      success: true,

      latest: {
        date,

        file: latest.name,

        url:
          `https://www.impactone.news/daily/${latest.name}`
      }
    })

  } catch (error) {
    console.error('daily-latest error:', error)

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
