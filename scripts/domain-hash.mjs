// Huella de src/domain/*.ts (sin tests): sirve para saber si el paquete de las Edge Functions está al día.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function domainHash(dir = 'src/domain') {
  const h = createHash('sha256');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts')).sort()) {
    h.update(f);
    h.update(readFileSync(join(dir, f)));
  }
  return h.digest('hex').slice(0, 16);
}
