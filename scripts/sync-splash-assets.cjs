/**
 * Kopieert assets/splash-icon.png naar de ingebakken iOS/Android splash-bestanden.
 * Nodig omdat `expo prebuild` bij bestaande native folders de splash-afbeelding niet altijd ververst.
 * Daarna: `npx expo run:ios` / `run:android` opnieuw.
 */
const { copyFileSync, existsSync, readdirSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const src = join(root, 'assets', 'splash-icon.png');

if (!existsSync(src)) {
  console.error('Ontbreekt:', src);
  process.exit(1);
}

const iosSet = join(root, 'ios', 'opstap', 'Images.xcassets', 'SplashScreenLegacy.imageset');
if (existsSync(iosSet)) {
  for (const f of ['image.png', 'image@2x.png', 'image@3x.png']) {
    copyFileSync(src, join(iosSet, f));
  }
  console.log('iOS SplashScreenLegacy.imageset bijgewerkt.');
} else {
  console.warn('Geen ios/ map — sla iOS over (draai eerst expo prebuild).');
}

const androidRes = join(root, 'android', 'app', 'src', 'main', 'res');
if (existsSync(androidRes)) {
  let n = 0;
  for (const name of readdirSync(androidRes)) {
    if (!name.startsWith('drawable-')) continue;
    const p = join(androidRes, name, 'splashscreen_logo.png');
    if (existsSync(p)) {
      copyFileSync(src, p);
      n++;
    }
  }
  if (n) console.log(`Android splashscreen_logo.png bijgewerkt (${n} densities).`);
  else console.warn('Geen android splashscreen_logo.png gevonden.');
} else {
  console.warn('Geen android/ map — sla Android over.');
}
