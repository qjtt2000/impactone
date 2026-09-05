import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = new URL(req.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const likeIndex = parts.lastIndexOf('like')

    // POST /comments/{id}/like
    if (req.method === 'POST' && likeIndex > 0) {
      const id = parts[likeIndex - 1]
      const supabase = db()
      const { data, error } = await supabase.from('comments').select('likes').eq('id', id).single()
      if (error) throw error
      const { error: updateError } = await supabase.from('comments').update({ likes: Number(data.likes || 0) + 1 }).eq('id', id)
      if (updateError) throw updateError
      return json({ ok: true })
    }

    if (req.method === 'GET') {
      const issue = String(url.searchParams.get('issue') || '').trim()
      if (!issue) return json([], 200)
      const { data, error } = await db().from('comments')
        .select('id,name,body,likes,pinned,created_at,parent_id')
        .eq('issue_key', issue)
        .eq('status', 'approved')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return json((data || []).map(c => ({ id:c.id, name:c.name, text:c.body, likes:c.likes, created_at:c.created_at, parent_id:c.parent_id })))
    }

    if (req.method === 'POST') {
      const payload = await req.json()
      const issue = String(payload.issue || '').trim().slice(0, 80)
      const name = String(payload.name || '').trim().slice(0, 30)
      const body = String(payload.text || '').trim().slice(0, 1000)
      const pageUrl = String(payload.url || '').slice(0, 500)
      if (!issue || !name || !body) return json({ error: 'Missing fields' }, 400)
      const { data, error } = await db().from('comments').insert({ issue_key:issue, name, body, page_url:pageUrl, status:'pending' }).select('id,created_at').single()
      if (error) throw error
      return json({ id:data.id, created_at:data.created_at, pending:true }, 201)
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (e) {
    console.error(e)
    return json({ error: 'Request failed' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type':'application/json; charset=utf-8' } })
}
