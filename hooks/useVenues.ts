import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Tables } from '../types/supabase';

export type VenuePin = Pick<Tables<'venues'>, 'id' | 'name' | 'address' | 'lat' | 'lng' | 'type' | 'description'>;

export function useVenues() {
  const [venues, setVenues] = useState<VenuePin[]>([]);

  useEffect(() => {
    supabase
      .from('venues')
      .select('id, name, address, lat, lng, type, description')
      .eq('active', true)
      .then(({ data, error }) => {
        if (error) console.error('useVenues fout:', error.message);
        if (data) setVenues(data);
      });
  }, []);

  return venues;
}
