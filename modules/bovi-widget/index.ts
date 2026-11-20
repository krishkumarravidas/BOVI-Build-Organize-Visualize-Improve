import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface Subscription {
  remove(): void;
}

interface BoviWidgetNative {
  setWidgetData(json: string): Promise<void>;
  /** Returns the queued widget actions as a JSON array and clears the queue. */
  takeActions(): string;
  /** Asks the launcher to place a widget; false where pinning isn't supported. */
  pinWidget(kind: string): boolean;
  canPinWidgets(): boolean;
  /** Ids of widgets currently on the home screen, per kind. */
  placedWidgets(): Record<string, number>;
  addListener(event: 'onAction', listener: () => void): Subscription;
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<BoviWidgetNative>('BoviWidget') : null;

export const widgetAvailable = native != null;

/** Widget kinds, matching the native providers. */
export type WidgetKind = 'next' | 'glance' | 'today' | 'habits' | 'attendance' | 'exam' | 'gamedev' | 'dial' | 'week' | 'screentime';

/** Pushes a new snapshot to the home-screen widgets (no-op where unavailable). */
export function setWidgetData(data: unknown): void {
  native?.setWidgetData(JSON.stringify(data)).catch(() => {
    // Widgets are a convenience; a failed redraw is retried on the next change.
  });
}

/** Drains actions taken on widgets (ticks, attendance, focus...) since the last call. */
export function takeWidgetActions(): string | null {
  try {
    return native?.takeActions() ?? null;
  } catch {
    return null;
  }
}

/** Calls `listener` whenever a widget queues an action while the app is running. */
export function onWidgetAction(listener: () => void): () => void {
  if (!native) return () => {};
  try {
    const sub = native.addListener('onAction', listener);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

export function canPinWidgets(): boolean {
  try {
    return native?.canPinWidgets() ?? false;
  } catch {
    return false;
  }
}

export function pinWidget(kind: WidgetKind): boolean {
  try {
    return native?.pinWidget(kind) ?? false;
  } catch {
    return false;
  }
}

export function placedWidgets(): Partial<Record<WidgetKind, number>> {
  try {
    return (native?.placedWidgets() as Partial<Record<WidgetKind, number>>) ?? {};
  } catch {
    return {};
  }
}
