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
      page = 'pages/webview/webview',

      content = '影响力·每日必读已更新',
      author = 'IMPACTONE',
      source = '影响力·每日必读',
      date
    } = req.body || {}

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
      console.error(
        'Missing server environment variables'
      )

      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      })
    }

    // =====================================================
    // 生成纽约日期
    // =====================================================

    let messageDate = date

    if (!messageDate) {
      const formatter =
        new Intl.DateTimeFormat(
          'en-CA',
          {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }
        )

      messageDate =
        formatter
          .format(new Date())
          .replace(/-/g, '/')
    }

    // =====================================================
    // 微信模板内容
    // =====================================================

    const templateData = {
      thing1: {
        value: String(content).slice(0, 20)
      },

      date2: {
        value: messageDate
      },

      name3: {
        value: String(author).slice(0, 10)
      },

      thing4: {
        value: String(source).slice(0, 20)
      }
    }

    // =====================================================
    // 工具函数：等待
    // =====================================================

    const sleep = (ms) =>
      new Promise(resolve =>
        setTimeout(resolve, ms)
      )

    // =====================================================
    // 查询 pending 订阅
    // 遇到 502 / 503 / 504 自动重试
    // =====================================================

    const subscriptionUrl =
      `${supabaseUrl}/rest/v1/wechat_subscriptions` +
      `?status=eq.pending` +
      `&template_id=eq.${encodeURIComponent(templateId)}` +
      `&order=subscribed_at.asc`

    let subscriptionResponse = null
    let lastSubscriptionError = ''

    const retryDelays = [0, 3000, 6000]

    for (
      let attempt = 0;
      attempt < retryDelays.length;
      attempt++
    ) {
      if (retryDelays[attempt] > 0) {
        await sleep(retryDelays[attempt])
      }

      try {
        subscriptionResponse =
          await fetch(
            subscriptionUrl,
            {
              headers: {
                apikey: supabaseKey
              }
            }
          )

        if (subscriptionResponse.ok) {
          break
        }

        lastSubscriptionError =
          await subscriptionResponse.text()

        console.error(
          `Load subscriptions failed, attempt ${attempt + 1}:`,
          subscriptionResponse.status,
          lastSubscriptionError
        )

        const retryable =
          [502, 503, 504]
            .includes(subscriptionResponse.status)

        if (!retryable) {
          break
        }

      } catch (error) {
        lastSubscriptionError =
          error instanceof Error
            ? error.message
            : String(error)

        console.error(
          `Load subscriptions exception, attempt ${attempt + 1}:`,
          lastSubscriptionError
        )
      }
    }

    if (
      !subscriptionResponse ||
      !subscriptionResponse.ok
    ) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load subscriptions after retries',
        detail: lastSubscriptionError
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

    // =====================================================
    // 同一用户本期只消费一条授权
    // =====================================================

    const uniqueSubscriptions = []
    const usedOpenids = new Set()

    for (const item of subscriptions) {
      if (
        item.openid &&
        !usedOpenids.has(item.openid)
      ) {
        usedOpenids.add(item.openid)
        uniqueSubscriptions.push(item)
      }
    }

    // =====================================================
    // 获取微信 access_token
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

    let sent = 0
    let failed = 0

    const results = []

    // =====================================================
    // 逐个发送
    // =====================================================

    for (
      const subscription
      of uniqueSubscriptions
    ) {
      try {
        const sendUrl =
          'https://api.weixin.qq.com/cgi-bin/message/subscribe/send' +
          '?access_token=' +
          encodeURIComponent(accessToken)

        const sendResponse =
          await fetch(
            sendUrl,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json; charset=utf-8'
              },

              body: JSON.stringify({
                touser:
                  subscription.openid,

                template_id:
                  templateId,

                page,

                data:
                  templateData
              })
            }
          )

        const sendData =
          await sendResponse.json()

        if (sendData.errcode === 0) {
          sent++

          const sentAt =
            new Date().toISOString()

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

                  Prefer:
                    'return=minimal'
                },

                body: JSON.stringify({
                  status: 'sent',
                  sent_at: sentAt
                })
              }
            )

          if (!updateResponse.ok) {
            const updateDetail =
              await updateResponse.text()

            console.error(
              'Message sent but database update failed:',
              subscription.id,
              updateDetail
            )
          }

          results.push({
            id: subscription.id,
            success: true
          })

          continue
        }

        failed++

        console.error(
          'WeChat send failed:',
          subscription.id,
          sendData
        )

        results.push({
          id: subscription.id,
          success: false,
          errcode:
            sendData.errcode,
          errmsg:
            sendData.errmsg
        })

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

      message: 'WeChat subscription send completed',

      templateData,

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
