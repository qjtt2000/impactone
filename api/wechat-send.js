export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    })
  }

  try {
    const {
      openid,
      page = 'pages/index/index',
      data
    } = req.body || {}

    if (!openid) {
      return res.status(400).json({
        success: false,
        error: 'Missing OpenID'
      })
    }

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing template data'
      })
    }

    const appid = process.env.WECHAT_MINIPROGRAM_APPID
    const secret = process.env.WECHAT_MINIPROGRAM_APPSECRET
    const templateId = process.env.WECHAT_SUBSCRIBE_TEMPLATE_ID

    if (!appid || !secret || !templateId) {
      console.error('Missing WeChat environment variables')

      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      })
    }

    // 1. 获取微信 access_token
    const tokenUrl =
      'https://api.weixin.qq.com/cgi-bin/token' +
      '?grant_type=client_credential' +
      '&appid=' + encodeURIComponent(appid) +
      '&secret=' + encodeURIComponent(secret)

    const tokenResponse = await fetch(tokenUrl)
    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      console.error('Get access_token failed:', tokenData)

      return res.status(400).json({
        success: false,
        error: 'Failed to get access token',
        detail: tokenData
      })
    }

    // 2. 发送订阅消息
    const sendUrl =
      'https://api.weixin.qq.com/cgi-bin/message/subscribe/send' +
      '?access_token=' +
      encodeURIComponent(tokenData.access_token)

    const sendResponse = await fetch(sendUrl, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        touser: openid,
        template_id: templateId,
        page,
        data
      })
    })

    const sendData = await sendResponse.json()

    if (sendData.errcode !== 0) {
      console.error('Send subscribe message failed:', sendData)

      return res.status(400).json({
        success: false,
        error: 'Send subscribe message failed',
        detail: sendData
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Subscription message sent'
    })

  } catch (error) {
    console.error('wechat-send error:', error)

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}


