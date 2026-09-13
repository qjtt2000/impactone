export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    })
  }

  try {
    const {
      adminKey,
      page = 'pages/index/index',
      data
    } = req.body || {}

    // 1. 后台发送接口鉴权
    const expectedAdminKey =
      process.env.WECHAT_SEND_ADMIN_KEY

    if (
      !expectedAdminKey ||
      adminKey !== expectedAdminKey
    ) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing template data'
      })
    }

    const appid =
      process.env.WECHAT_MINIPROGRAM_APPID

    const secret =
      process.env.WECHAT_MINIPROGRAM_APPSECRET

    const templateId =
      process.env.WECHAT_SUBSCRIBE_TEMPLATE_ID

    const supabaseUrl =
      process.env.SUPABASE_URL

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (
      !appid ||
      !secret ||
      !templateId ||
      !supabaseUrl ||
      !supabaseKey
    ) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      })
    }

    // 2. 查询所有 pending 授权
    const subscriptionResponse = await fetch(
      `${supabaseUrl}/rest/v1/wechat_subscriptions` +
      `?status=eq.pending` +
      `&template_id=eq.${encodeURIComponent(templateId)}` +
      `&order=subscribed_at.asc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    )

    if (!subscriptionResponse.ok) {
      const detail =
        await subscriptionResponse.text()

      console.error(
        'Load subscriptions failed:',
        detail
      )

      return res.status(500).json({
        success: false,
        error: 'Failed to load subscriptions'
      })
    }

    const subscriptions =
      await subscriptionResponse.json()

    if (
      !Array.isArray(subscriptions) ||
      subscriptions.length === 0
    ) {
      return res.status(200).json({
        success: true,
        message: 'No pending subscriptions',
        sent: 0,
        failed: 0
      })
    }

    // 3. 同一个 OpenID 本期只使用一条授权
    const uniqueSubscriptions = []

    const usedOpenids = new Set()

    for (const item of subscriptions) {
      if (!usedOpenids.has(item.openid)) {
        usedOpenids.add(item.openid)
        uniqueSubscriptions.push(item)
      }
    }

    // 4. 获取微信 access_token
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

    let sent = 0
    let failed = 0

    const results = []

    // 5. 给每个用户发送一条
    for (const subscription of uniqueSubscriptions) {
      try {
        const sendUrl =
          'https://api.weixin.qq.com/cgi-bin/message/subscribe/send' +
          '?access_token=' +
          encodeURIComponent(accessToken)

        const sendResponse =
          await fetch(sendUrl, {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              touser:
                subscription.openid,

              template_id:
                templateId,

              page,

              data
            })
          })

        const sendData =
          await sendResponse.json()

        // 发送成功
        if (sendData.errcode === 0) {
          sent++

          // 6. 把这一条 pending 标记为 sent
          const updateResponse =
            await fetch(
              `${supabaseUrl}/rest/v1/wechat_subscriptions` +
              `?id=eq.${subscription.id}`,
              {
                method: 'PATCH',

                headers: {
                  'Content-Type':
                    'application/json',

                  apikey:
                    supabaseKey,

                  Authorization:
                    `Bearer ${supabaseKey}`,

                  Prefer:
                    'return=minimal'
                },

                body: JSON.stringify({
                  status: 'sent',
                  sent_at:
                    new Date().toISOString()
                })
              }
            )

          if (!updateResponse.ok) {
            console.error(
              'Failed to update subscription:',
              subscription.id
            )
          }

          results.push({
            id: subscription.id,
            success: true
          })

        } else {
          failed++

          console.error(
            'Send failed:',
            subscription.id,
            sendData
          )

          results.push({
            id: subscription.id,
            success: false,
            detail: sendData
          })
        }

      } catch (error) {
        failed++

        console.error(
          'Send exception:',
          subscription.id,
          error
        )

        results.push({
          id: subscription.id,
          success: false,
          error: 'Send exception'
        })
      }
    }

    return res.status(200).json({
      success: true,
      totalPending:
        subscriptions.length,
      uniqueUsers:
        uniqueSubscriptions.length,
      sent,
      failed,
      results
    })

  } catch (error) {
    console.error(
      'wechat-send error:',
      error
    )

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
