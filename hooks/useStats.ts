import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { getCached, setCached } from '../utils/cache';

export type UserStats = {
  eventsAangemaakt: number;
  eventsBijgewoond: number;
  opkomstKeren: number;
  opkomstTotaal: number;
  opkomstPercentage: number | null;
  actiefSindsWeken: number | null;
};


const TTL = 5 * 60 * 1000;

export function useStats(userId: string | null) {
  const cacheKey = userId ? `stats:${userId}` : null;
  const [stats, setStats] = useState<UserStats | null>(() =>
    cacheKey ? getCached<UserStats>(cacheKey, TTL) : null
  );
  const [laden, setLaden] = useState(!stats);

  useEffect(() => {
    if (!userId || !cacheKey) { setLaden(false); return; }
    if (getCached<UserStats>(cacheKey, TTL)) { setLaden(false); return; }
    (async () => {
      const [profielRes, aangemaaaktRes, bijgewoomndRes, opkomstRes, totaalRes] = await Promise.all([
        supabase.from('profiles').select('created_at').eq('id', userId).single(),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('creator_id', userId),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('showed_up', true),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('showed_up', true),
        supabase.from('event_registrations').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'approved'),
      ]);

      const opkomstKeren = opkomstRes.count ?? 0;
      const opkomstTotaal = totaalRes.count ?? 0;

      const createdAt = profielRes.data?.created_at ? new Date(profielRes.data.created_at) : null;
      const actiefSindsWeken = createdAt
        ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 7))
        : null;

      const result: UserStats = {
        eventsAangemaakt: aangemaaaktRes.count ?? 0,
        eventsBijgewoond: bijgewoomndRes.count ?? 0,
        opkomstKeren,
        opkomstTotaal,
        opkomstPercentage: opkomstTotaal > 0 ? Math.round((opkomstKeren / opkomstTotaal) * 100) : null,
        actiefSindsWeken,
      };
      setCached(cacheKey, result);
      setStats(result);
      setLaden(false);
    })();
  }, [userId]);

  return { stats, laden };
}
