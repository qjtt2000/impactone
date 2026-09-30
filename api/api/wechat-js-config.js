import crypto from 'crypto'

let cachedAccessToken = null
let accessTokenExpireAt = 0

let cachedJsapiTicket = null
let jsapiTicketExpireAt = 0

async function getAccessToken(appid, secret) {
  const now = Date.now()

  if (cachedAccessToken && now < accessTokenExpireAt) {
    return cachedAccessToken
  }

  const url =
    'https://api.weixin.qq.com/cgi-bin/token' +
    '?grant_type=client_credential' +
    '&appid=' + encodeURIComponent(appid) +
    '&secret=' + encodeURIComponent(secret)

  const response = await fetch(url)
  const data = await response.json()

  if (!data.access_token) {
    throw new Error(
      `Failed to get access_token: ${JSON.stringify(data)}`
    )
  }

  cachedAccessToken = data.access_token

  // 提前 5 分钟刷新
  accessTokenExpireAt =
    now + (data.expires_in - 300) * 1000

  return cachedAccessToken
}

async function getJsapiTicket(accessToken) {
  const now = Date.now()

  if (cachedJsapiTicket && now < jsapiTicketExpireAt) {
    return cachedJsapiTicket
  }

  const url =
    'https://api.weixin.qq.com/cgi-bin/ticket/getticket' +
    '?access_token=' + encodeURIComponent(accessToken) +
    '&type=jsapi'

  const response = await fetch(url)
  const data = await response.json()

  if (data.errcode !== 0 || !data.ticket) {
    throw new Error(
      `Failed to get jsapi_ticket: ${JSON.stringify(data)}`
    )
  }

  cachedJsapiTicket = data.ticket

  jsapiTicketExpireAt =
    now + (data.expires_in - 300) * 1000

  return cachedJsapiTicket
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    })
  }

  try {
    const pageUrl = req.query.url

    if (!pageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing url'
      })
    }

    /*
      这里使用“公众号”的 AppID / AppSecret。

      注意：
      不是你的小程序：
      wxaeb8ecc70c72f194

      需要在 Vercel 增加两个环境变量：

      WECHAT_OFFICIAL_ACCOUNT_APPID
      WECHAT_OFFICIAL_ACCOUNT_APPSECRET
    */

    const appid =
      process.env.WECHAT_OFFICIAL_ACCOUNT_APPID

    const secret =
      process.env.WECHAT_OFFICIAL_ACCOUNT_APPSECRET

    if (!appid || !secret) {
      return res.status(500).json({
        success: false,
        error:
          'Missing official account AppID/AppSecret'
      })
    }

    const accessToken =
      await getAccessToken(appid, secret)

    const ticket =
      await getJsapiTicket(accessToken)

    const nonceStr =
      crypto.randomBytes(16).toString('hex')

    const timestamp =
      Math.floor(Date.now() / 1000)

    const string1 =
      'jsapi_ticket=' + ticket +
      '&noncestr=' + nonceStr +
      '&timestamp=' + timestamp +
      '&url=' + pageUrl

    const signature =
      crypto
        .createHash('sha1')
        .update(string1)
        .digest('hex')

    return res.status(200).json({
      success: true,
      appId: appid,
      timestamp,
      nonceStr,
      signature
    })

  } catch (error) {
    console.error(
      'wechat-js-config error:',
      error
    )

    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
