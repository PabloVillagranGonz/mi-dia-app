# Mi Día

App móvil personal de rutina diaria con planificación dominical (Expo + TypeScript + Expo Router + Supabase).
Se usa como **app web instalable (PWA)** desplegada en Vercel; el mismo código compila para nativo.

## Antes de cualquier tarea
- Lee `docs/mi-dia-spec.md`: decisiones cerradas, modelo de datos, reglas de negocio, pantallas y datos iniciales.
- Las capturas de `docs/diseno/` son la referencia visual (estilo y estructura).
- Si una captura y el spec no coinciden, manda el spec (sección 8).

## Estructura
```
src/
  app/            Rutas de Expo Router (solo pantallas). (tabs)/ = Hoy · Semana · Rutina · Ajustes
  components/     Componentes de UI (TimelineBlock, NowCard, ProgressBar, ActivitySheet, WeekDayCard, CategoryChip…)
  data/           Única puerta a los datos: types.ts + repositorio. mock/ (datos de prueba) y supabase/ (real)
  domain/         Lógica de negocio pura y testeada (horas, solapes, medianoche, eventos, huecos, progreso, semanas)
    __tests__/    Tests de Jest (`npm test`)
  hooks/          Hooks de React (useNow, useDay…)
  lib/            Clientes de terceros (supabase.ts)
  notifications/  Notificaciones: locales en nativo (index.ts) y Web Push en la web (index.web.ts, webPush.ts)
  theme/          Colores, fuentes y espaciados
supabase/migrations/  SQL de la base de datos (avisos Web Push: 0003 y 0004)
supabase/functions/   Edge Functions (push: envía los avisos de la web)
public/               index.html, manifest, iconos y sw.js de la PWA
docs/             Spec, capturas y guía de puesta en marcha
```
- Expo SDK 58. Instalar paquetes siempre con `npx expo install`.
- Sin `.env.local` la app usa `src/data/mock/`; con claves, Supabase.
- Variantes solo web: archivos `.web.ts(x)` (alert, TimePicker, notificaciones, WebSafeArea, WebPushSettings).
- Build web: `npx expo export -p web && node scripts/build-sw.mjs` (lo hace Vercel en cada push a `main`).
- Antes de dar algo por terminado: `npm run typecheck`, `npm test` y, si se toca SQL de avisos o `src/domain/notifications.ts`, `npm run test:sql`.

## Convenciones
- Todo el texto de la interfaz en español. Formato 24 h. Semana de lunes a domingo. Zona horaria Europe/Madrid.
- Horas de planificación como `time` local + `date`, nunca timestamps.
- El acceso a datos va siempre por `src/data/`; las pantallas no llaman a Supabase directamente.
- La lógica de negocio (recorte de eventos, medianoche, solapes, huecos, progreso) en funciones puras con tests.
