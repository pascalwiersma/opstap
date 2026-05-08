import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('DIDIT_API_KEY')
    const workflowId = Deno.env.get('DIDIT_WORKFLOW_ID')
    if (!apiKey || !workflowId) {
      return new Response(JSON.stringify({ error: 'Didit niet geconfigureerd' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id: workflowId, vendor_data: user.id }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Didit session aanmaken mislukt:', body)
      return new Response(JSON.stringify({ error: 'Kon verificatiesessie niet aanmaken' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const session = await res.json() as {
      session_id: string
      session_token: string
      status: string
    }

    // Sla sessie op voor audit trail
    await supabase.from('identity_verifications').upsert({
      user_id: user.id,
      session_id: session.session_id,
      status: session.status,
      vendor_data: user.id,
    }, { onConflict: 'session_id' })

    return new Response(JSON.stringify({ session_token: session.session_token }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('didit-session fout:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
