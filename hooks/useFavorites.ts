import { useState } from 'react';
import { supabase } from '../services/supabase';
import { getCached, invalidateCache, setCached } from '../utils/cache';

const TTL = 2 * 60 * 1000;

function cacheKey(userId: string) {
  return `favorites:${userId}`;
}

export function useFavorites() {
  const [favorietIds, setFavorietIds] = useState<Set<string>>(new Set());

  async function laden() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = cacheKey(user.id);
    const cached = getCached<string[]>(key, TTL);
    if (cached) { setFavorietIds(new Set(cached)); return; }
    const { data } = await supabase
      .from('user_favorites')
      .select('venue_id')
      .eq('user_id', user.id);
    if (data) {
      const ids = data.map((r: { venue_id: string }) => r.venue_id);
      setCached(key, ids);
      setFavorietIds(new Set(ids));
    }
  }

  async function toggle(venueId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    invalidateCache(cacheKey(user.id));
    if (favorietIds.has(venueId)) {
      await supabase.from('user_favorites').delete()
        .eq('user_id', user.id).eq('venue_id', venueId);
      setFavorietIds(prev => { const next = new Set(prev); next.delete(venueId); return next; });
    } else {
      await supabase.from('user_favorites').insert({ user_id: user.id, venue_id: venueId });
      setFavorietIds(prev => new Set([...prev, venueId]));
    }
  }

  return { favorietIds, laden, toggle };
}
