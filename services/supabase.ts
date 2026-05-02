import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Database } from '../types/supabase';

// SecureStore heeft een limiet van 2048 bytes per waarde op iOS.
// Supabase sessies kunnen groter zijn, dus grote waarden worden in stukken opgeslagen.
const CHUNK_SIZE = 1800;

const storage = {
  async getItem(key: string): Promise<string | null> {
    const single = await SecureStore.getItemAsync(key);
    if (single !== null) return single;

    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return null;

    const count = parseInt(countStr, 10);
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}__${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}__count`, String(chunks.length));
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}__${i}`, chunk))
    );
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);

    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return;

    const count = parseInt(countStr, 10);
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}__count`),
      ...Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}__${i}`)
      ),
    ]);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
