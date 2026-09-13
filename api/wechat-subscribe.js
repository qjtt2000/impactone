export default async function handler(req, res) {
  // 只允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    })
  }

  try {
    const {
      openid,
      templateId
    } = req.body || {}

    // 1. 检查参数
    if (!openid) {
      return res.status(400).json({
        success: false,
        error: 'Missing OpenID'
      })
    }

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Missing Template ID'
      })
    }

    // 2. 读取环境变量
    const supabaseUrl =
      process.env.SUPABASE_URL

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    const officialTemplateId =
      process.env.WECHAT_SUBSCRIBE_TEMPLATE_ID

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      console.error(
        'Missing Supabase environment variables'
      )

      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      })
    }

    // 3. 防止前端传入错误的微信模板 ID
    if (
      officialTemplateId &&
      templateId !== officialTemplateId
    ) {
      console.error(
        'Invalid template ID:',
        templateId
      )

      return res.status(400).json({
        success: false,
        error: 'Invalid Template ID'
      })
    }

    // 4. 保存本次订阅授权
    //
    // 注意：
    // 每一次用户点击微信“允许”，
    // 都代表一次新的订阅消息发送机会。
    //
    // 所以这里使用 INSERT，
    // 不要按照 openid 覆盖以前的记录。

    const response = await fetch(
      `${supabaseUrl}/rest/v1/wechat_subscriptions`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          apikey:
            supabaseServiceRoleKey,

          Authorization:
            `Bearer ${supabaseServiceRoleKey}`,

          Prefer:
            'return=representation'
        },

        body: JSON.stringify({
          openid,
          template_id: templateId,
          status: 'pending',
          subscribed_at:
            new Date().toISOString()
        })
      }
    )

    const responseText =
      await response.text()

    let data = null

    if (responseText) {
      try {
        data =
          JSON.parse(responseText)
      } catch {
        data = responseText
      }
    }

    // 5. Supabase 保存失败
    if (!response.ok) {
      console.error(
        'Supabase insert failed:',
        response.status,
        data
      )

      return res.status(500).json({
        success: false,
        error:
          'Failed to save subscription',
        detail: data
      })
    }

    // 6. 保存成功
    console.log(
      'WeChat subscription saved:',
      {
        openid,
        templateId
      }
    )

    return res.status(200).json({
      success: true,
      message:
        'Subscription saved successfully'
    })

  } catch (error) {
    console.error(
      'wechat-subscribe error:',
      error
    )

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
