# Puesta en marcha y operación

Cómo está montado Mi Día, cómo se vuelve a montar desde cero y cómo se comprueba que todo va bien.

**App:** https://mi-dia-app-seven.vercel.app · **Supabase:** `bnqxmgtpqwhaztvpneyx` (West EU 2) · **Repo:** `PabloVillagranGonz/mi-dia-app` · **Google Cloud:** proyecto «Mi Dia» (`mi-dia-514216`)

---

## Estado (comprobado el 9-11-2026)

| Pieza | Estado | Detalle |
|---|---|---|
| Base de datos | ✅ | Migraciones `0001` → `0010` aplicadas · RLS en todas las tablas |
| Auth | ✅ | Email + contraseña · **registro cerrado** · altas desde `/admin` |
| App web (PWA) | ✅ | Vercel publica cada push a `main` · instalada en el iPhone · funciona sin conexión |
| Avisos Web Push | ✅ | Función `push` + cron `mi-dia-push` cada minuto · probado en el iPhone |
| Google Calendar | ✅ | Funciones `gcal-oauth`, `gcal-sync`, `gcal-webhook` + cron `mi-dia-gcal-sync` cada 15 min · probado con Running |
| Administración | ✅ | Consola en `/admin` para la cuenta de administración: Resumen, Usuarios, Demo, Google Calendar, Sistema |
| Demo pública | ✅ | `demo@example.com` · restablecida cada noche (cron `mi-dia-demo-reset`) |
| Calidad | ✅ | `typecheck`, `lint`, 125 tests de Jest y 16 tests SQL en verde |

### Pendiente
- [ ] Más adelante: compartir cosas con los usuarios desde `/admin`.

### Descartado
- Build nativa con Apple Developer (99 €/año) y uso diario con Expo Go: la PWA cubre el uso diario (§4). El código sigue compilando para nativo.
- Widget de iOS / Live Activity: no es posible en una PWA.

---

## 1. Repositorio y secretos

- Remoto: `https://github.com/PabloVillagranGonz/mi-dia-app.git`. Cada push a `main` despliega la web (§4).
- **Nunca se suben:** `.env.local` y `client_secret_*.json` (credencial de Google) están en `.gitignore`. GitHub tiene además *push protection*: rechaza un push que contenga secretos.
- Dónde vive cada secreto:

| Secreto | Dónde |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (públicas) | `.env.local` y Vercel → Environment Variables (tipo *Config*) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` | Supabase → Edge Functions → Secrets |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GCAL_STATE_SECRET`, `APP_URL` (y `GCAL_ALLOWED_USER_IDS`, opcional) | Supabase → Edge Functions → Secrets |
| `DEMO_EMAIL`, `DEMO_PASSWORD` (públicos: cuenta de demostración) | Supabase → Edge Functions → Secrets · en la app, por defecto en `src/data/auth.ts` |
| `push_cron_secret` (mismo valor que `CRON_SECRET`) | Supabase → Vault (lo leen los crons) |
| Contraseña de la base de datos | Gestor de contraseñas |

Subir secretos sin pegarlos en ningún sitio: `npx supabase secrets set --env-file <archivo> --remote=bnqxmgtpqwhaztvpneyx` y borrar el archivo después.

---

## 2. Supabase

### Migraciones

Se ejecutan en orden. Con la CLI (requiere `npx supabase login` una vez en la app Terminal):

```bash
npx supabase db query --remote=bnqxmgtpqwhaztvpneyx --yes -f supabase/migrations/000X_….sql
```

| Archivo | Qué hace |
|---|---|
| `0001_init.sql` | Tablas (`categories`, `template_activities`, `weeks`, `day_activities`, `settings`), RLS y trigger de alta: cada usuario nuevo recibe 4 categorías, ajustes y una rutina de ejemplo |
| `0002_apply_day_changes.sql` | `apply_day_changes()`: borra, recorta e inserta las actividades de un día en una sola transacción |
| `0003_web_push.sql` | `push_subscriptions`, `push_log` y `claim_due_push()` (mismas reglas que `src/domain/notifications.ts`) |
| `0004_push_cron.sql` | Cron `mi-dia-push` cada minuto → función `push` |
| `0005_google_calendar.sql` | `google_accounts`, `google_calendars`, `google_events` (tokens solo para el servidor), `external_id`, `apply_day_changes_as()`, cerrojo de sincronización y Realtime en `day_activities` |
| `0006_gcal_cron.sql` | Cron `mi-dia-gcal-sync` cada 15 min → función `gcal-sync` |
| `0007_gcal_hidden.sql` | Ocultar calendarios en Ajustes |
| `0008_admin.sql` | `user_flags` (admin, demo, acceso a Google; la app solo lee la suya) y `reset_user_data()` para la demo |
| `0009_demo_cron.sql` | Cron `mi-dia-demo-reset` cada noche (04:00 UTC) → función `admin` |
| `0010_admin_system.sql` | `admin_system_status()`: crons, errores de las funciones y avisos de hoy (sección Sistema) |

> **0004, 0006 y 0009** leen el secreto de Vault. Antes de ejecutarlas por primera vez: `select vault.create_secret('<CRON_SECRET>', 'push_cron_secret');` en una consulta aparte (no en el archivo, que está en git).

### Edge Functions

Todas se despliegan **sin verificación de JWT** (cada una comprueba la sesión, el secreto del cron o el token del canal por sí misma):

```bash
npx supabase functions deploy <nombre> --remote=bnqxmgtpqwhaztvpneyx --no-verify-jwt --use-api
```

| Función | La llama | Para |
|---|---|---|
| `push` | Cron cada minuto · botón de prueba en Ajustes | Enviar los avisos Web Push |
| `gcal-oauth` | Ajustes · Google (vuelta de OAuth vía `/api/gcal/callback` en Vercel) | Conectar, estado y desconectar Google |
| `gcal-sync` | Cron cada 15 min · Ajustes al cambiar calendarios | Sincronizar y reconstruir los días |
| `gcal-webhook` | Google (`events.watch`) | Aviso de cambio → sincroniza al momento |
| `admin` | Ajustes → Administración · cron nocturno | Usuarios, estadísticas, acceso a Google y restablecer la demo |

**Si se cambia algo de `src/domain/`:** `npm run build:functions` y volver a desplegar `admin` y las tres `gcal-*` (`npm test` falla si el paquete está desactualizado).

---

## 3. Usuarios, administración y demo

El registro está **cerrado** (Authentication → Sign In / Providers → *Allow new users to sign up* desactivado). Cada usuario tiene sus propios datos (RLS).

### Consola de administración

Una **cuenta solo para administrar**, separada de la personal: al entrar va directa a la consola (`/admin`) y no ve la app de rutina. Las cuentas normales nunca ven la consola. Quién es admin lo decide `user_flags.is_admin`, y el servidor lo comprueba en cada llamada.

En ordenador o tablet tiene un **sidebar** fijo; en el móvil, un menú ☰. Secciones:

| Sección | Qué hay |
|---|---|
| **Resumen** | Usuarios, activos esta semana, % de tareas hechas, dispositivos con avisos, progreso por usuario, altas recientes y uso de la demo |
| **Usuarios** | Lista y **Nuevo usuario** (email y contraseña inicial, se propone una aleatoria; se le crea la rutina de ejemplo). Ficha de cada uno: racha, tareas por semana, tiempo por categoría; cambiar contraseña, dar o quitar Google, desactivar, borrar |
| **Demo** | Estado de la cuenta pública y **Restablecer ahora** |
| **Google Calendar** | Quién tiene acceso, quién está conectado, qué calendarios usa y si sus avisos al momento están vigentes |
| **Sistema** | Cada cron (última ejecución, fallos en 24 h), errores de las funciones y avisos enviados hoy |

Al dar de alta a alguien: pásale la URL y la contraseña por un canal privado; en su iPhone, Safari → Añadir a pantalla de inicio → entrar → Ajustes → «Activar avisos en este dispositivo».

**Hacer admin a una cuenta** (no hay botón, a propósito; esa cuenta deja de ver la app de rutina):
```sql
insert into public.user_flags (user_id, is_admin) select id, true from auth.users where email = '…'
on conflict (user_id) do update set is_admin = true;
```

**Rutina propia desde el principio:** sustituir sus filas de `template_activities` por SQL antes de que entre. Si ya entró y no ha marcado nada, borrar sus `weeks` para que la app las regenere.

> La app aún no tiene «cambiar contraseña» para el propio usuario: se la cambias desde su ficha en el panel.

### Cuenta de demostración (portfolio)

- **Credenciales públicas:** `demo@example.com` / `midia-demo-2026` (secretos `DEMO_EMAIL` y `DEMO_PASSWORD`). Puede tocar todo lo suyo; no ve Google, ni Administración, ni los avisos al móvil.
- **Cada noche** (cron `mi-dia-demo-reset`, 04:00 UTC) la función `admin` le restablece los datos de ejemplo, el email y la contraseña, y cierra sus sesiones. También desde el panel: **Restablecer ahora**.
- **Botón «Probar la demo» en el login:** entra con esas credenciales (valores por defecto en `src/data/auth.ts`).
- **Cambiar las credenciales:** actualizar los secretos `DEMO_EMAIL`/`DEMO_PASSWORD` de Supabase y `EXPO_PUBLIC_DEMO_EMAIL`/`EXPO_PUBLIC_DEMO_PASSWORD` en Vercel (o los valores por defecto del código), y pulsar **Restablecer ahora**.

## 4. App web (PWA) en Vercel

- **Configuración:** proyecto `mi-dia-app` importado en Vercel (framework *Other*; build y salida en `vercel.json`). Variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` como *Config*.
- **Build:** `npx expo export -p web && node scripts/build-sw.mjs`. `vercel.json` reenvía `/api/gcal/*` a la función `gcal-oauth` y el resto a `index.html`.
- **En el iPhone:** Safari → Compartir → **Añadir a pantalla de inicio** → iniciar sesión una vez. Si cambia el icono, hay que borrarla y volver a añadirla.
- **Actualizaciones:** la versión nueva se descarga sola la siguiente vez que se abre con conexión. Si se quiere ya: cerrarla del todo y abrirla.
- **Sin conexión:** el service worker (`public/sw.js`) guarda la app; `scripts/build-sw.mjs` le mete la versión y la lista de archivos en cada build. Las lecturas de hoy y de la semana se guardan en el dispositivo.
- **Variantes web** (`*.web.ts(x)`): diálogos propios de la app (`src/lib/alert.web.ts` → `DialogHost`, nunca los del navegador), `<input type="time">`, márgenes del notch por CSS, avisos por Web Push.
- **Probar el build en local:** `npx expo export -p web && node scripts/build-sw.mjs && npx serve -s dist`.

---

## 5. Avisos (Web Push)

```
pg_cron (cada minuto) → push → claim_due_push() → Web Push → service worker → aviso en el iPhone
```

- Al empezar cada actividad con *Aviso*: «Hasta las HH:MM · Siguiente: X». Recordatorio de planificación el día y la hora de Ajustes.
- Se activan **por dispositivo** en Ajustes («Activar avisos en este dispositivo»). En el iPhone solo con la app abierta desde la pantalla de inicio (iOS 16.4+).
- Cada aviso se apunta en `push_log` y sale una sola vez; si el cron se retrasa hasta 3 minutos, sale igualmente.
- **Regenerar las claves VAPID** (no hay copia fuera de Supabase): `npx web-push generate-vapid-keys`, cambiar la pública en `src/notifications/webPush.ts`, subir los secretos y volver a activar los avisos en cada dispositivo.

---

## 6. Google Calendar → Mi Día

```
Google ──aviso──> gcal-webhook ─┐
pg_cron cada 15 min ──> gcal-sync ─┼─> google_events ─> rebuildDay ─> day_activities ─(Realtime)─> app
Ajustes ──> gcal-oauth (conectar / estado / desconectar)
```

- **Solo lectura** y solo para los usuarios con acceso (se da desde la ficha del usuario en `/admin`; `GCAL_ALLOWED_USER_IDS` queda como respaldo). Al resto no les aparece la sección. La demo nunca tiene acceso.
- Ventana: semana actual y siguiente. Los eventos **de todo el día no se traen**: hay que ponerles hora.
- **Google siempre gana:** recorta rutina y eventos manuales. Al mover o borrar en Google, la rutina vuelve solo en el tramo que queda libre. «Hecha» y la nota se conservan, también si el evento cambia de día.
- En Ajustes: activar calendarios, elegir su categoría y **ocultar** los que no se usan (ojo tachado; «Mostrar ocultos» para recuperarlos).

**Configuración (hecha):**
- **Google Cloud:**
  - API de Calendar activada.
  - Pantalla de permisos externa **en producción y sin verificar**. Al conectar sale «Google no ha verificado esta app» → Configuración avanzada → Ir a Mi Día. No hace falta verificar la marca: es solo para apps públicas.
  - Permisos: `calendar.readonly` y email.
  - Cliente OAuth «Aplicación web» con la URI `https://mi-dia-app-seven.vercel.app/api/gcal/callback`.
- **Supabase:**
  - Migraciones `0005`, `0006` y `0007`.
  - Secretos de Google (§1).
  - Las tres funciones `gcal-*`.

**Dar acceso a otro usuario:** Administración → su ficha → interruptor «Google Calendar». Google admite hasta 100 usuarios sin verificar la app.

**Quitarlo:** Ajustes → Desconectar (revoca el permiso, borra sus datos y restaura la rutina) y `select cron.unschedule('mi-dia-gcal-sync');`.

---

## 7. Desarrollo local

```bash
npm install
npm run web          # o npm start (Expo)
```

- Sin `.env.local` la app usa **datos de prueba** en memoria (`src/data/mock/`); con claves, Supabase.
- Instalar paquetes siempre con `npx expo install`.
- **Antes de subir:** `npm run typecheck && npm run lint && npm test && npm run test:sql`.
- **Nativo (solo pruebas):** `npx expo start` y escanear el QR con Expo Go (misma cuenta de Expo en el Mac y en el móvil). Expo Go solo abre la última SDK (el proyecto está en la **58**); al actualizar: `npx expo install expo@latest && npx expo install --fix`. En nativo los avisos son locales (hoy + mañana; iOS admite 64 pendientes).
- `npm run check:supabase` comprueba la conexión con Supabase desde el Mac.

---

## 8. Comprobar que todo va bien

En Supabase → SQL Editor (o `npx supabase db query --remote=… "…"`):

```sql
-- Crons activos y sus últimas ejecuciones
select jobname, schedule, active from cron.job;
select status, start_time from cron.job_run_details order by start_time desc limit 5;

-- Respuestas de las funciones llamadas por los crons (push: {"due":…}; gcal-sync: {"users":…})
select status_code, left(content::text, 120), created from net._http_response order by created desc limit 5;

-- Datos sanos: no debería devolver nada (actividades solapadas desde hoy)
select a.user_id, a.date, a.title, b.title
from day_activities a join day_activities b
  on a.user_id = b.user_id and a.date = b.date and a.id < b.id
 and a.start_time < b.end_time and b.start_time < a.end_time
where a.date >= current_date;

-- Google: calendarios, eventos traídos y caducidad de los canales de aviso
select summary, enabled, hidden, channel_expires_at from google_calendars order by summary;
```

Logs de las funciones: Supabase → Edge Functions → `<función>` → **Logs**.
