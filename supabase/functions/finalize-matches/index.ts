import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// ── Stream Chat client ────────────────────────────────────────────────────────

async function maakStreamClient() {
  const key = Deno.env.get('STREAM_API_KEY')
  const secret = Deno.env.get('STREAM_API_SECRET')
  if (!key || !secret) return null
  try {
    const { StreamChat } = await import('npm:stream-chat@9')
    return StreamChat.getInstance(key, secret)
  } catch (e) {
    console.error('Stream Chat laden mislukt:', e)
    return null
  }
}

// ── Groepschat aanmaken ───────────────────────────────────────────────────────

async function maakGroepschat(
  matchId: string,
  datum: string,
  memberIds: string[],
): Promise<string | null> {
  const stream = await maakStreamClient()
  if (!stream) {
    console.warn('Stream Chat niet geconfigureerd — sla groepschat over')
    return null
  }

  try {
    // Zorg dat alle gebruikers bestaan in Stream
    await stream.upsertUsers(memberIds.map(id => ({ id })))

    const channel = stream.channel('messaging', `match-${matchId}`, {
      name: `Avondje uit ${datum}`,
      members: memberIds,
      created_by_id: memberIds[0],
    })
    await channel.create()

    await channel.sendMessage({
      text: `🎉 Jullie match is bevestigd! Met z'n ${memberIds.length}en vanavond de stad in. Spreek hier af!`,
      user_id: memberIds[0],
    })

    return channel.id ?? null
  } catch (e) {
    console.error('Groepschat aanmaken mislukt:', e)
    return null
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const today = new Date().toISOString().split('T')[0]

  // Haal alle 'proposed' matches van vandaag op
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, date')
    .eq('date', today)
    .eq('status', 'proposed')

  if (matchErr) {
    console.error('Matches ophalen mislukt:', matchErr)
    return new Response(JSON.stringify({ error: matchErr.message }), { status: 500 })
  }

  if (!matches || matches.length === 0) {
    return new Response(JSON.stringify({ message: 'Geen voorgestelde matches vandaag' }), { status: 200 })
  }

  const resultaten = []

  for (const match of matches) {
    // Haal alle members op met hun huidige response
    const { data: members, error: membersErr } = await supabase
      .from('match_members')
      .select('id, user_id, response')
      .eq('match_id', match.id)

    if (membersErr || !members) {
      console.error('Match members ophalen mislukt:', membersErr)
      continue
    }

    const accepted = members.filter(m => m.response === 'accepted')
    const pending = members.filter(m => m.response === 'pending')

    // Niet-beantwoorde uitnodigingen als 'declined' markeren
    if (pending.length > 0) {
      await supabase
        .from('match_members')
        .update({ response: 'declined', responded_at: new Date().toISOString() })
        .in('id', pending.map(m => m.id))
    }

    if (accepted.length >= 3) {
      // Genoeg aanwezigen: match bevestigen en groepschat aanmaken
      const acceptedIds = accepted.map(m => m.user_id)
      const groupChatId = await maakGroepschat(match.id, today, acceptedIds)

      await supabase
        .from('matches')
        .update({ status: 'confirmed', group_chat_id: groupChatId })
        .eq('id', match.id)

      resultaten.push({ matchId: match.id, status: 'confirmed', leden: accepted.length, groupChatId })
    } else {
      // Te weinig aanwezigen: match annuleren
      await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', match.id)

      resultaten.push({ matchId: match.id, status: 'cancelled', leden: accepted.length })
    }
  }

  return new Response(JSON.stringify({ ok: true, datum: today, resultaten }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
