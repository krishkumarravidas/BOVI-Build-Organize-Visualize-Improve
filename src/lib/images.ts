import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Lets you pick an image (Android's photo picker — no storage permission needed) and copies it into the
 * app's documents folder, so it survives the picker's cache being cleared. Returns the stored URI, or null
 * if cancelled.
 */
export async function pickAndStoreImage(folder: 'refs' | 'bugs', id: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web') return asset.uri;
  try {
    const dir = new Directory(Paths.document, folder);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const ext = /\.(png|jpe?g|webp|gif|heic)$/i.exec(asset.fileName ?? asset.uri)?.[1]?.toLowerCase() ?? 'jpg';
    const dest = new File(dir, `${id}.${ext}`);
    if (dest.exists) dest.delete();
    await new File(asset.uri).copy(dest);
    return dest.uri;
  } catch {
    // Fall back to the picker's URI; it works until the system clears its cache.
    return asset.uri;
  }
}

/** Deletes a stored image (ignores anything outside the app's documents folder). */
export function deleteStoredImage(uri: string | undefined) {
  if (!uri || Platform.OS === 'web') return;
  try {
    if (!uri.startsWith(Paths.document.uri)) return;
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}
