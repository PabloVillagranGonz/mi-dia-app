# Mi Día

App móvil personal de rutina diaria con planificación dominical (Expo + TypeScript + Expo Router + Supabase).

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
  notifications/  Programación de notificaciones locales
  theme/          Colores, fuentes y espaciados
supabase/migrations/  SQL que se pega en Supabase
docs/             Spec, capturas y guía de puesta en marcha
```
- Expo SDK 58. Instalar paquetes siempre con `npx expo install`.
- Sin `.env.local` la app usa `src/data/mock/`; con claves, Supabase.
- Antes de dar algo por terminado: `npm run typecheck` y `npm test`.

## Convenciones
- Todo el texto de la interfaz en español. Formato 24 h. Semana de lunes a domingo. Zona horaria Europe/Madrid.
- Horas de planificación como `time` local + `date`, nunca timestamps.
- El acceso a datos va siempre por `src/data/`; las pantallas no llaman a Supabase directamente.
- La lógica de negocio (recorte de eventos, medianoche, solapes, huecos, progreso) en funciones puras con tests.
