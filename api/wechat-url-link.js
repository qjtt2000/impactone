export default async function handler(req, res) {
  // =====================================================
  // 只允许 GET
  // =====================================================

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    })
  }

  try {
    // =====================================================
    // 1. 读取环境变量
    // 与现有 wechat-login / wechat-send 保持一致
    // =====================================================

    const appid =
      process.env.WECHAT_MINIPROGRAM_APPID

    const secret =
      process.env.WECHAT_MINIPROGRAM_APPSECRET_NEW

    if (!appid || !secret) {
      console.error(
        'Missing WeChat environment variables'
      )

      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      })
    }

    // =====================================================
    // 2. 获取微信 access_token
    // =====================================================

    const tokenUrl =
      'https://api.weixin.qq.com/cgi-bin/token' +
      '?grant_type=client_credential' +
      '&appid=' +
      encodeURIComponent(appid) +
      '&secret=' +
      encodeURIComponent(secret)

    const tokenResponse =
      await fetch(tokenUrl)

    const tokenData =
      await tokenResponse.json()

    if (!tokenData.access_token) {
      console.error(
        'Get access_token failed:',
        tokenData
      )

      return res.status(500).json({
        success: false,
        error: 'Failed to get access token',
        detail: tokenData
      })
    }

    const accessToken =
      tokenData.access_token

    // =====================================================
    // 3. 调用微信 URL Link API
    //
    // 用户打开这个 Link 后：
    // 进入小程序首页 pages/index/index
    //
    // 用户随后点击：
    // 「接收下一期更新」
    //
    // 即可调用 wx.requestSubscribeMessage
    // =====================================================

    const generateUrl =
      'https://api.weixin.qq.com/wxa/generate_urllink' +
      '?access_token=' +
      encodeURIComponent(accessToken)

    const linkResponse =
      await fetch(
        generateUrl,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json; charset=utf-8'
          },

          body: JSON.stringify({
            path:
              'pages/index/index',

            query:
              '',

            is_expire:
              false
          })
        }
      )

    const linkData =
      await linkResponse.json()

    // =====================================================
    // 4. 微信返回错误
    // =====================================================

    if (
      linkData.errcode &&
      linkData.errcode !== 0
    ) {
      console.error(
        'Generate WeChat URL Link failed:',
        linkData
      )

      return res.status(400).json({
        success: false,
        error:
          'Failed to generate WeChat URL Link',
        errcode:
          linkData.errcode,
        errmsg:
          linkData.errmsg
      })
    }

    // =====================================================
    // 5. 检查 URL Link
    // =====================================================

    if (!linkData.url_link) {
      console.error(
        'URL Link missing:',
        linkData
      )

      return res.status(500).json({
        success: false,
        error:
          'WeChat did not return URL Link',
        detail:
          linkData
      })
    }

    // =====================================================
    // 6. 返回 URL Link
    // =====================================================

    console.log(
      'WeChat URL Link generated successfully'
    )

    return res.status(200).json({
      success: true,

      urlLink:
        linkData.url_link,

      path:
        'pages/index/index'
    })

  } catch (error) {
    console.error(
      'wechat-url-link error:',
      error
    )

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
