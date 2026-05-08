import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-didit-signature',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json() as {
      session_id: string
      status: string
      vendor_data: string
    }

    const { session_id, status, vendor_data: userId } = body

    if (!session_id || !status || !userId) {
      return new Response(JSON.stringify({ error: 'Ongeldig webhook payload' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Werk verificatierecord bij
    await supabase
      .from('identity_verifications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('session_id', session_id)

    // Markeer profiel als geverifieerd bij Approved status
    if (status === 'Approved') {
      await supabase
        .from('profiles')
        .update({
          identity_verified: true,
          identity_verified_at: new Date().toISOString(),
        })
        .eq('id', userId)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('didit-webhook fout:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
