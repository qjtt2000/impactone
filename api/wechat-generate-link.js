export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
   const appid = process.env.WECHAT_MINIPROGRAM_APPID;
const secret = process.env.WECHAT_MINIPROGRAM_APPSECRET_NEW;

    if (!appid || !secret) {
      return res.status(500).json({
        success: false,
        error: 'Missing WECHAT_APPID or WECHAT_SECRET'
      });
    }

    // 1. 获取微信 access_token
    const tokenUrl =
      `https://api.weixin.qq.com/cgi-bin/token` +
      `?grant_type=client_credential` +
      `&appid=${encodeURIComponent(appid)}` +
      `&secret=${encodeURIComponent(secret)}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('获取 access_token 失败：', tokenData);

      return res.status(500).json({
        success: false,
        error: 'Failed to get access_token',
        detail: tokenData
      });
    }

    const accessToken = tokenData.access_token;

    // 2. 生成小程序 URL Link
    const linkResponse = await fetch(
      `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${encodeURIComponent(
        accessToken
      )}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: 'pages/index/index',
          query: '',
          is_expire: false
        })
      }
    );

    const linkData = await linkResponse.json();

    console.log('generate_urllink 返回：', linkData);

    if (linkData.errcode && linkData.errcode !== 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate URL Link',
        detail: linkData
      });
    }

    if (!linkData.url_link) {
      return res.status(500).json({
        success: false,
        error: 'WeChat did not return url_link',
        detail: linkData
      });
    }

    // 3. 返回生成的 URL Link
    return res.status(200).json({
      success: true,
      url_link: linkData.url_link
    });
  } catch (error) {
    console.error('生成 URL Link 异常：', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
