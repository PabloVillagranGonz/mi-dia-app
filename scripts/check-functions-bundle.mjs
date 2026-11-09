// Comprueba que supabase/functions/_shared/domain.js está al día con src/domain/.
// Se ejecuta antes de `npm test`. Si falla: npm run build:functions
import { readFileSync } from 'node:fs';

import { domainHash } from './domain-hash.mjs';

const bundle = readFileSync('supabase/functions/_shared/domain.js', 'utf8');
const stamped = /domain-hash: (\w+)/.exec(bundle)?.[1];
if (stamped !== domainHash()) {
  console.error('✗ supabase/functions/_shared/domain.js está desactualizado: ejecuta npm run build:functions');
  process.exit(1);
}
console.log('✓ paquete de las Edge Functions al día');
