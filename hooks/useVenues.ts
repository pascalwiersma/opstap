import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Tables } from '../types/supabase';

export type VenuePin = Pick<Tables<'venues'>, 'id' | 'name' | 'lat' | 'lng' | 'type' | 'description' | 'photo_url' | 'opening_hours'>;

export function useVenues() {
  const [venues, setVenues] = useState<VenuePin[]>([]);

  useEffect(() => {
    supabase
      .from('venues')
      .select('id, name, lat, lng, type, description, photo_url, opening_hours')
      .eq('active', true)
      .then(({ data, error }) => {
        if (error) console.error('useVenues fout:', error.message);
        if (data) setVenues(data);
      });
  }, []);

  return venues;
}
