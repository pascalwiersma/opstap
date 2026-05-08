import { streamClient } from './stream'
import { supabase } from './supabase'

async function haalStreamToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Niet ingelogd')

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stream-token`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) throw new Error(`Stream token ophalen mislukt: ${res.status}`)
  const { token } = await res.json() as { token: string }
  return token
}

// Verbindt de huidige gebruiker met Stream Chat als dat nog niet gedaan is
export async function verbindStream(userId: string, naam: string, avatarUrl: string | null) {
  if (streamClient.userID) return
  const token = await haalStreamToken()
  await streamClient.connectUser(
    { id: userId, name: naam, image: avatarUrl ?? undefined },
    token,
  )
}

// Haalt een bestaand DM-kanaal op of maakt een nieuw aan.
// Geeft het Stream channel ID terug.
export async function getOrCreateDm(
  mijnUserId: string,
  anderUserId: string,
): Promise<string> {
  // Canonicale volgorde: kleinste UUID eerst (zodat het paar uniek is)
  const [u1, u2] = [mijnUserId, anderUserId].sort()
  // Stream Chat max is 64 tekens. UUID's zonder streepjes zijn 32 chars elk;
  // we nemen de eerste 28 chars van elk → "dm-" + 28 + "-" + 28 = 60 chars.
  const s1 = u1.replace(/-/g, '').slice(0, 28)
  const s2 = u2.replace(/-/g, '').slice(0, 28)
  const channelId = `dm-${s1}-${s2}`

  // Controleer of DM al bestaat in de database
  const { data: bestaand } = await supabase
    .from('direct_messages')
    .select('stream_channel_id')
    .eq('user1_id', u1)
    .eq('user2_id', u2)
    .maybeSingle()

  if (bestaand) return bestaand.stream_channel_id

  // Maak Stream-kanaal aan
  const channel = streamClient.channel('messaging', channelId, {
    members: [mijnUserId, anderUserId],
  })
  await channel.create()

  // Sla op in database voor persistentie en terugzoeken
  await supabase.from('direct_messages').insert({
    user1_id: u1,
    user2_id: u2,
    stream_channel_id: channelId,
  })

  return channelId
}
