export default async function handler(req, res) {
  // 只允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    })
  }

  try {
    const { code } = req.body || {}

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Missing WeChat login code'
      })
    }

    // 从 Vercel Environment Variables 读取
    const appid = process.env.WECHAT_MINIPROGRAM_APPID
    const secret = process.env.WECHAT_MINIPROGRAM_APPSECRET

    if (!appid || !secret) {
      console.error('Missing WeChat environment variables')

      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      })
    }

    // 用小程序临时 code 换取 OpenID
    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      '?appid=' + encodeURIComponent(appid) +
      '&secret=' + encodeURIComponent(secret) +
      '&js_code=' + encodeURIComponent(code) +
      '&grant_type=authorization_code'

    const response = await fetch(url)
    const data = await response.json()

    // 微信接口返回错误
    if (data.errcode) {
      console.error('WeChat jscode2session error:', data)

      return res.status(400).json({
        success: false,
        error: 'WeChat login failed',
        errcode: data.errcode,
        errmsg: data.errmsg
      })
    }

    if (!data.openid) {
      console.error('OpenID missing:', data)

      return res.status(400).json({
        success: false,
        error: 'OpenID not returned'
      })
    }

    // 注意：绝对不要把 session_key 返回给前端
    return res.status(200).json({
      success: true,
      openid: data.openid
    })

  } catch (error) {
    console.error('wechat-login error:', error)

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
