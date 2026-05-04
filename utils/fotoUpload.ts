import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';

export async function kiesEnUploadFoto(pad: string): Promise<string | null> {
  const toestemming = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!toestemming.granted) return null;

  const resultaat = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (resultaat.canceled || !resultaat.assets[0]) return null;

  const uri = resultaat.assets[0].uri;
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('avatars')
    .upload(pad, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(pad);
  return data.publicUrl;
}
