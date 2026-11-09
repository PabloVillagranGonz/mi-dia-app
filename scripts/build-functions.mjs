// Empaqueta la lógica pura de src/domain/ para las Edge Functions de Supabase (Deno).
// Uso: npm run build:functions  →  supabase/functions/_shared/domain.js (+ domain.d.ts)
// `npm test` falla si el paquete no está al día (scripts/check-functions-bundle.mjs).

import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

import { domainHash } from './domain-hash.mjs';

const OUT = 'supabase/functions/_shared/domain.js';

const result = await build({
  entryPoints: ['src/domain/server.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  alias: { '@': './src' },
  write: false,
  legalComments: 'none',
});

const header = `// GENERADO por scripts/build-functions.mjs desde src/domain/. NO EDITAR.\n// domain-hash: ${domainHash()}\n`;
writeFileSync(OUT, header + result.outputFiles[0].text);
console.log(`✓ ${OUT}`);
