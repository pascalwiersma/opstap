import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';

function base64NaarArrayBuffer(base64: string): ArrayBuffer {
  const binair = atob(base64);
  const bytes = new Uint8Array(binair.length);
  for (let i = 0; i < binair.length; i++) {
    bytes[i] = binair.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function kiesEnUploadFoto(pad: string): Promise<string | null> {
  const toestemming = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!toestemming.granted) return null;

  const resultaat = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  if (resultaat.canceled || !resultaat.assets[0]?.base64) return null;

  const arrayBuffer = base64NaarArrayBuffer(resultaat.assets[0].base64);

  const { error } = await supabase.storage
    .from('avatars')
    .upload(pad, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(pad);
  return data.publicUrl;
}
