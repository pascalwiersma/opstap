import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { StreamChat } from 'npm:stream-chat@9'

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

    // Verifieer de Supabase sessie van de aanvrager
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

    // Genereer een Stream Chat JWT met de server-side secret
    const streamApiKey = Deno.env.get('STREAM_API_KEY')
    const streamApiSecret = Deno.env.get('STREAM_API_SECRET')
    if (!streamApiKey || !streamApiSecret) {
      console.error('STREAM_API_KEY of STREAM_API_SECRET niet ingesteld')
      return new Response(JSON.stringify({ error: 'Stream niet geconfigureerd' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const serverClient = StreamChat.getInstance(streamApiKey, streamApiSecret)
    const token = serverClient.createToken(user.id)

    return new Response(JSON.stringify({ token }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('stream-token fout:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
