// Después de `expo export -p web`: escribe en dist/sw.js la versión del build y la lista de
// archivos que el service worker guarda para que la app abra sin conexión.
// Uso: node scripts/build-sw.mjs [carpeta]   (por defecto dist; lo llama el build de Vercel)

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const SKIP = new Set(['sw.js', 'metadata.json']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Expo exporta todas las variantes de iconos y tipografías de los paquetes, aunque solo se usan unas pocas.
// Se guardan por adelantado solo las que usa la app (src/app/_layout.tsx y los Ionicons);
// cualquier otro archivo lo guarda el service worker la primera vez que se pide.
const USED_ASSETS = [
  /\/Ionicons\.[0-9a-f]+\.ttf$/,
  /\/Inter_(400Regular|500Medium|600SemiBold|700Bold)\.[0-9a-f]+\.ttf$/,
  /\/BarlowCondensed_(600SemiBold|700Bold)\.[0-9a-f]+\.ttf$/,
];
const isPrecached = (f) => !f.startsWith('assets/') || USED_ASSETS.some((re) => re.test(f));

const all = walk(dist)
  .map((p) => relative(dist, p).split(sep).join('/'))
  .filter((f) => !SKIP.has(f) && !f.endsWith('.map'))
  .sort();
const files = all.filter(isPrecached);

const hash = createHash('sha256');
for (const f of all) hash.update(f).update(readFileSync(join(dist, f)));
// Fecha delante para que el service worker sepa qué versiones son las más recientes
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const build = `${stamp}-${hash.digest('hex').slice(0, 10)}`;

// La página se guarda como «/»: algunos servidores redirigen /index.html y una respuesta redirigida no sirve sin conexión
const urls = files.map((f) => (f === 'index.html' ? '/' : encodeURI('/' + f)));

const swPath = join(dist, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
if (!sw.includes("const BUILD = 'dev';") || !sw.includes('const PRECACHE = [];')) {
  throw new Error('dist/sw.js no tiene los marcadores BUILD/PRECACHE');
}
writeFileSync(
  swPath,
  sw.replace("const BUILD = 'dev';", `const BUILD = '${build}';`).replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(urls)};`),
);

const kb = Math.round(files.reduce((s, f) => s + statSync(join(dist, f)).size, 0) / 1024);
console.log(`sw.js: build ${build}, ${urls.length} archivos (${kb} KB) para uso sin conexión`);
