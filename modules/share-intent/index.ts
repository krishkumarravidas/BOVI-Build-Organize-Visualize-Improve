import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** What another app shared to BOVI. */
export interface SharedPayload {
  text: string | null;
  subject: string | null;
  /** file:// URIs of shared images, copied into the app. */
  images: string[];
  mimeType: string;
}

interface ShareIntentNative {
  takeShared(): Promise<SharedPayload | null>;
  addListener(event: 'onShare', listener: () => void): { remove(): void };
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<ShareIntentNative>('ShareIntent') : null;

export const shareIntentAvailable = native != null;

/** The pending share (each one is returned once), or null. */
export async function takeShared(): Promise<SharedPayload | null> {
  try {
    return (await native?.takeShared()) ?? null;
  } catch {
    return null;
  }
}

/** Fires when something is shared while BOVI is already running. */
export function onShare(listener: () => void): () => void {
  if (!native) return () => {};
  try {
    const sub = native.addListener('onShare', listener);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
