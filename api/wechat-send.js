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

      // 以下三个参数以后可以由网站发布程序传入
      // 不传则自动使用默认值
      content = '影响力·每日必读已更新',
      author = 'IMPACTONE',
      source = '影响力·每日必读',
      date
    } = req.body || {}

    // =====================================================
    // 1. 验证后台发送密钥
    // =====================================================

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

    // =====================================================
    // 2. 环境变量
    // =====================================================

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
    // 3. 生成纽约日期
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

      // en-CA 一般得到 YYYY-MM-DD
      messageDate =
        formatter
          .format(new Date())
          .replace(/-/g, '/')
    }

    // =====================================================
    // 4. 微信模板内容
    //
    // 模板：
    // thing1 = 更新内容
    // date2  = 更新时间
    // name3  = 作者
    // thing4 = 来源
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
    // 5. 查询所有 pending 订阅
    // =====================================================

    const subscriptionResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/wechat_subscriptions` +
        `?status=eq.pending` +
        `&template_id=eq.${encodeURIComponent(templateId)}` +
        `&order=subscribed_at.asc`,
        {
          headers: {
            apikey: supabaseKey
          }
        }
      )

    if (!subscriptionResponse.ok) {
      const detail =
        await subscriptionResponse.text()

      console.error(
        'Load subscriptions failed:',
        subscriptionResponse.status,
        detail
      )

      return res.status(500).json({
        success: false,
        error: 'Failed to load subscriptions',
        detail
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
    // 6. 同一用户本期只使用一次授权
    //
    // 例如同一个人有两条 pending：
    // 本期只发送一条；
    // 另一条留给下一期。
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
    // 7. 获取微信 access_token
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
    // 8. 逐个发送
    // =====================================================

    let sent = 0
    let failed = 0

    const results = []

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

        // =================================================
        // 发送成功
        // =================================================

        if (sendData.errcode === 0) {
          sent++

          const sentAt =
            new Date().toISOString()

          // -----------------------------------------------
          // 9. 当前这一条 pending → sent
          // -----------------------------------------------

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

        // =================================================
        // 微信返回发送失败
        // =================================================

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

    // =====================================================
    // 10. 返回发送统计
    // =====================================================

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
