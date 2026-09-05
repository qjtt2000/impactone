import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const { email, source = 'daily' } = await req.json()
    const normalized = String(email || '').trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return json({ error: 'Invalid email' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { error } = await supabase.from('subscribers').upsert({
      email: normalized,
      status: 'active',
      source: String(source).slice(0, 50),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    if (error) throw error
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: 'Unable to subscribe' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  })
}
