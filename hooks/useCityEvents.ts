import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

// city_events is not yet in the generated Supabase types — cast to bypass until types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type CityEventPin = {
  id: string;
  name: string;
  description: string | null;
  event_type: string | null;
  location_type: 'point' | 'region';
  lat: number | null;
  lng: number | null;
  polygon: [number, number][] | null;
  start_date: string;
  end_date: string;
  color: string;
  photo_url: string | null;
};

export function useCityEvents() {
  const [events, setEvents] = useState<CityEventPin[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    db
      .from('city_events')
      .select('id, name, description, event_type, location_type, lat, lng, polygon, start_date, end_date, color, photo_url')
      .eq('active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .then(({ data, error }: { data: CityEventPin[] | null; error: { message: string } | null }) => {
        if (error) console.error('useCityEvents fout:', error.message);
        if (data) setEvents(data);
      });
  }, []);

  return events;
}
