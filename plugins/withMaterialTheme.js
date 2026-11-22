/**
 * Makes the Android app theme Material 3 (needed for the Material clock and calendar pickers) and maps
 * every Material colour role to BOVI's black-and-white palette, so native dialogs (time/date pickers,
 * alerts) match the app instead of Material's default purple.
 */
const { withAndroidStyles, withAndroidColors, withAndroidColorsNight, withAppBuildGradle, AndroidConfig } = require('expo/config-plugins');

const MATERIAL_DEP = "implementation 'com.google.android.material:material:1.12.0'";

// Material 3 role → [light, dark]. Mirrors src/theme/colors.ts.
const ROLES = {
  colorPrimary: ['#111111', '#F2F2F2'],
  colorOnPrimary: ['#FFFFFF', '#0A0A0A'],
  colorPrimaryContainer: ['#E6E6E6', '#2E2E2E'],
  colorOnPrimaryContainer: ['#111111', '#F2F2F2'],
  colorSecondary: ['#5E5E5E', '#9B9B9B'],
  colorOnSecondary: ['#FFFFFF', '#0A0A0A'],
  colorSecondaryContainer: ['#E6E6E6', '#2E2E2E'],
  colorOnSecondaryContainer: ['#111111', '#F2F2F2'],
  colorTertiary: ['#5E5E5E', '#9B9B9B'],
  colorOnTertiary: ['#FFFFFF', '#0A0A0A'],
  colorTertiaryContainer: ['#DADADA', '#3A3A3A'],
  colorOnTertiaryContainer: ['#111111', '#F2F2F2'],
  colorSurface: ['#FFFFFF', '#151515'],
  colorOnSurface: ['#111111', '#F2F2F2'],
  colorOnSurfaceVariant: ['#5E5E5E', '#9B9B9B'],
  colorSurfaceContainerLowest: ['#FFFFFF', '#0A0A0A'],
  colorSurfaceContainerLow: ['#F8F8F7', '#121212'],
  colorSurfaceContainer: ['#F4F4F3', '#1B1B1B'],
  colorSurfaceContainerHigh: ['#F1F1F0', '#202020'],
  colorSurfaceContainerHighest: ['#EBEBEA', '#2A2A2A'],
  colorOutline: ['#8A8A8A', '#6B6B6B'],
  colorOutlineVariant: ['#E2E2E0', '#2A2A2A'],
  colorError: ['#B03A33', '#EE7A74'],
};
const BACKGROUND = ['#F4F4F3', '#0A0A0A'];

const colorName = (role) => `bovi_${role}`;

function withColors(config) {
  config = withAndroidColors(config, (c) => {
    for (const [role, [light]] of Object.entries(ROLES)) {
      c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: colorName(role), value: light });
    }
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: 'bovi_background', value: BACKGROUND[0] });
    return c;
  });
  return withAndroidColorsNight(config, (c) => {
    for (const [role, [, dark]] of Object.entries(ROLES)) {
      c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: colorName(role), value: dark });
    }
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: 'bovi_background', value: BACKGROUND[1] });
    return c;
  });
}

function withTheme(config) {
  return withAndroidStyles(config, (c) => {
    const styles = c.modResults.resources.style ?? [];
    const app = styles.find((s) => s.$.name === 'AppTheme');
    if (!app) return c;
    app.$.parent = 'Theme.Material3.DayNight.NoActionBar';
    const items = (app.item ?? []).filter((i) => !(i.$.name in ROLES) && i.$.name !== 'android:colorBackground');
    for (const role of Object.keys(ROLES)) items.push({ $: { name: role }, _: `@color/${colorName(role)}` });
    items.push({ $: { name: 'android:colorBackground' }, _: '@color/bovi_background' });
    app.item = items;
    return c;
  });
}

function withMaterialDependency(config) {
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('com.google.android.material:material')) {
      c.modResults.contents = c.modResults.contents.replace(/dependencies\s*\{/, (m) => `${m}\n    ${MATERIAL_DEP}`);
    }
    return c;
  });
}

module.exports = (config) => withMaterialDependency(withTheme(withColors(config)));
