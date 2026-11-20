/**
 * Adds BOVI to Android's share sheet: links/text and images (one or several).
 * The shared content is read by modules/share-intent.
 */
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const FILTERS = [
  { action: 'android.intent.action.SEND', mimeType: 'text/plain' },
  { action: 'android.intent.action.SEND', mimeType: 'image/*' },
  { action: 'android.intent.action.SEND_MULTIPLE', mimeType: 'image/*' },
];

module.exports = function withShareIntent(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity['intent-filter'] = activity['intent-filter'] ?? [];
    for (const f of FILTERS) {
      const exists = activity['intent-filter'].some(
        (existing) =>
          existing.action?.some((a) => a.$['android:name'] === f.action) &&
          existing.data?.some((d) => d.$['android:mimeType'] === f.mimeType),
      );
      if (exists) continue;
      activity['intent-filter'].push({
        action: [{ $: { 'android:name': f.action } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': f.mimeType } }],
      });
    }
    return cfg;
  });
};
