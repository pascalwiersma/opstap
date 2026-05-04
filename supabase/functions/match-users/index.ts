import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// ── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  interests: string[]
  preferredGroupSize: number
  pushToken: string | null
}

// ── Matching algoritme ───────────────────────────────────────────────────────

function jaccardScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const intersection = b.filter(x => setA.has(x)).length
  const union = new Set([...a, ...b]).size
  return intersection / union
}

function maakGroepen(users: UserProfile[]): UserProfile[][] {
  if (users.length < 3) return users.length > 0 ? [users] : []

  const targetSize = Math.round(
    users.reduce((s, u) => s + u.preferredGroupSize, 0) / users.length,
  )

  // Shuffle om bias te vermijden
  const pool = [...users].sort(() => Math.random() - 0.5)
  const groepen: UserProfile[][] = []

  while (pool.length >= 3) {
    const zaad = pool.shift()!
    const groepGrootte = Math.min(targetSize, pool.length + 1)

    // Sorteer resterende gebruikers op interesse-overlap met het zaad
    const gerangschikt = pool
      .map((u, i) => ({ i, score: jaccardScore(zaad.interests, u.interests) }))
      .sort((a, b) => b.score - a.score)

    const gekozenIndices = gerangschikt
      .slice(0, groepGrootte - 1)
      .map(x => x.i)
      .sort((a, b) => b - a) // aflopend zodat splice de juiste index houdt

    const groep: UserProfile[] = [zaad]
    for (const idx of gekozenIndices) {
      groep.push(pool.splice(idx, 1)[0])
    }
    groepen.push(groep)
  }

  // 1-2 overblijvers toevoegen aan de meest compatibele bestaande groep
  for (const overgebleven of pool) {
    if (groepen.length === 0) { groepen.push([overgebleven]); continue }

    let besteGroep = 0
    let besteScore = -1
    for (let g = 0; g < groepen.length; g++) {
      const gem = groepen[g].reduce(
        (s, u) => s + jaccardScore(overgebleven.interests, u.interests), 0,
      ) / groepen[g].length
      if (gem > besteScore) { besteScore = gem; besteGroep = g }
    }
    groepen[besteGroep].push(overgebleven)
  }

  return groepen
}

// ── Push notificaties ────────────────────────────────────────────────────────

async function stuurNotificaties(
  tokens: string[],
  matchId: string,
  aantalLeden: number,
  stad: string,
) {
  if (tokens.length === 0) return
  const berichten = tokens.map(token => ({
    to: token,
    title: 'Je match voor vanavond is gevonden! 🎉',
    body: `Er zijn ${aantalLeden} mensen die ook vanavond uit willen in ${stad}. Kom je definitief?`,
    data: { matchId, type: 'match_proposed' },
    sound: 'default',
  }))
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(berichten),
    })
  } catch (e) {
    console.error('Push notificatie fout:', e)
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const today = new Date().toISOString().split('T')[0]

  // 1. Haal alle actieve check-ins op voor vandaag
  const { data: checkIns, error: ciErr } = await supabase
    .from('check_ins')
    .select('id, user_id, city')
    .eq('date', today)
    .eq('status', 'active')

  if (ciErr) {
    console.error('check_ins ophalen mislukt:', ciErr)
    return new Response(JSON.stringify({ error: ciErr.message }), { status: 500 })
  }

  if (!checkIns || checkIns.length === 0) {
    return new Response(JSON.stringify({ message: 'Geen actieve check-ins vandaag' }), { status: 200 })
  }

  // 2. Groepeer per stad
  const perStad: Record<string, typeof checkIns> = {}
  for (const ci of checkIns) {
    const stad = ci.city ?? 'Groningen'
    if (!perStad[stad]) perStad[stad] = []
    perStad[stad].push(ci)
  }

  const resultaten: Record<string, unknown> = {}

  for (const [stad, stadCheckIns] of Object.entries(perStad)) {
    const userIds = stadCheckIns.map(ci => ci.user_id)

    if (userIds.length < 3) {
      resultaten[stad] = { overgeslagen: true, reden: 'Minder dan 3 gebruikers' }
      continue
    }

    // 3. Haal profielen en interesses parallel op
    const [profielRes, interesseRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, push_token, preferred_group_size')
        .in('id', userIds),
      supabase
        .from('user_interests')
        .select('user_id, interest')
        .in('user_id', userIds),
    ])

    const interesseMap: Record<string, string[]> = {}
    for (const r of interesseRes.data ?? []) {
      if (!interesseMap[r.user_id]) interesseMap[r.user_id] = []
      interesseMap[r.user_id].push(r.interest)
    }

    const users: UserProfile[] = (profielRes.data ?? []).map(p => ({
      id: p.id,
      interests: interesseMap[p.id] ?? [],
      preferredGroupSize: p.preferred_group_size ?? 4,
      pushToken: p.push_token ?? null,
    }))

    // 4. Matching
    const groepen = maakGroepen(users)
    let aangemaakteMatches = 0

    for (const groep of groepen) {
      // 5. Match record aanmaken
      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .insert({ date: today, status: 'proposed' })
        .select('id')
        .single()

      if (matchErr || !match) {
        console.error('Match aanmaken mislukt:', matchErr)
        continue
      }

      // Match members aanmaken
      const { error: membersErr } = await supabase.from('match_members').insert(
        groep.map(u => ({ match_id: match.id, user_id: u.id, response: 'pending' })),
      )
      if (membersErr) console.error('match_members aanmaken mislukt:', membersErr)

      // Check-ins updaten naar 'matched'
      await supabase
        .from('check_ins')
        .update({ status: 'matched' })
        .eq('date', today)
        .in('user_id', groep.map(u => u.id))

      // Push notificaties sturen
      const tokens = groep.map(u => u.pushToken).filter((t): t is string => t !== null)
      await stuurNotificaties(tokens, match.id, groep.length, stad)

      aangemaakteMatches++
    }

    resultaten[stad] = {
      gebruikers: users.length,
      groepen: groepen.length,
      matches: aangemaakteMatches,
    }
  }

  return new Response(JSON.stringify({ ok: true, datum: today, resultaten }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
