import { useState } from 'react'
import { startVerification, VerificationStatus } from '@didit-protocol/sdk-react-native'
import { supabase } from '../services/supabase'

export type VerificatieResultaat =
  | { type: 'approved' }
  | { type: 'pending' }
  | { type: 'declined' }
  | { type: 'cancelled' }
  | { type: 'error'; melding: string }

export function useIdentityVerification() {
  const [bezig, setBezig] = useState(false)

  async function startIdentiteitsVerificatie(): Promise<VerificatieResultaat> {
    if (bezig) return { type: 'cancelled' }
    setBezig(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { type: 'error', melding: 'Niet ingelogd' }

      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/didit-session`
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        const { error } = await res.json() as { error: string }
        return { type: 'error', melding: error ?? 'Sessie aanmaken mislukt' }
      }

      const { session_token } = await res.json() as { session_token: string }
      const result = await startVerification(session_token)

      switch (result.type) {
        case 'completed': {
          const status = result.session.status
          if (status === VerificationStatus.Approved) {
            await supabase.from('profiles').update({
              identity_verified: true,
              identity_verified_at: new Date().toISOString(),
              verification_status: 'approved',
            }).eq('id', session.user.id)
            return { type: 'approved' }
          }
          if (status === VerificationStatus.Pending) {
            await supabase.from('profiles').update({
              identity_verified: true,
              identity_verified_at: new Date().toISOString(),
              verification_status: 'pending',
            }).eq('id', session.user.id)
            return { type: 'pending' }
          }
          return { type: 'declined' }
        }
        case 'cancelled':
          return { type: 'cancelled' }
        case 'failed':
          return { type: 'error', melding: result.error?.message ?? 'Verificatie mislukt' }
        default:
          return { type: 'error', melding: 'Onbekend resultaat' }
      }
    } catch (e) {
      return { type: 'error', melding: e instanceof Error ? e.message : 'Onbekende fout' }
    } finally {
      setBezig(false)
    }
  }

  return { startIdentiteitsVerificatie, bezig }
}
