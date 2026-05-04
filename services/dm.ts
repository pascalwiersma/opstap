import { streamClient } from './stream'
import { supabase } from './supabase'

// Verbindt de huidige gebruiker met Stream Chat als dat nog niet gedaan is
export async function verbindStream(userId: string, naam: string, avatarUrl: string | null) {
  if (streamClient.userID) return
  await streamClient.connectUser(
    { id: userId, name: naam, image: avatarUrl ?? undefined },
    streamClient.devToken(userId),
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
  const channelId = `dm-${u1}-${u2}`

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
    created_by_id: mijnUserId,
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
