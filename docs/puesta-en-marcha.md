# Puesta en marcha — Supabase, app en el iPhone y notificaciones

Pasos en orden. Lo hecho está tachado; lo descartado se queda como histórico.

**App:** https://mi-dia-app-seven.vercel.app · **Supabase:** proyecto `bnqxmgtpqwhaztvpneyx` · **Repo:** `PabloVillagranGonz/mi-dia-app`

---

## Estado

### Hecho
- ~~Repositorio en GitHub~~ (§1)
- ~~Proyecto Supabase, tablas, RLS y alta automática de la rutina~~ (§2–3)
- ~~Login con email + contraseña y registro cerrado~~ (§4)
- ~~Conectar la app (`.env.local`)~~ (§5)
- ~~Migración `0002_apply_day_changes.sql`~~ (§9)
- ~~Decidir cómo usarla sin el Mac → PWA en Vercel~~ (§8)
- ~~Versión web en Vercel, instalada en el iPhone~~ (§10)
- ~~Márgenes del notch / indicador de inicio en la PWA~~ (§10)
- ~~Avisos Web Push: tablas, Edge Function, secretos, cron~~ (§11) — probado en el iPhone
- ~~App sin conexión (service worker)~~ (§10)
- ~~Icono propio~~
- ~~Tests SQL de los avisos (`npm run test:sql`)~~
- ~~Segundo usuario dado de alta con su propia rutina~~ (§12)

### Pendiente
- [ ] **Google Calendar** (§13): código hecho; falta Google Cloud (publicar app + cliente OAuth) y desplegar
- [ ] **Panel `/admin`** para ti: estadísticas y compartir cosas con los usuarios (más adelante)

### Descartado / solo para desarrollo
- Expo Go en el iPhone (§6) y notificaciones locales (§7): siguen funcionando en nativo, pero el uso diario es la PWA.
- Build nativa con Apple Developer (99 €/año) (§8).

---

## 1. Repositorio

- [x] ~~Inicializado con el remoto `https://github.com/PabloVillagranGonz/mi-dia-app.git`.~~
- [x] ~~Primer commit y `git push -u origin main`.~~
- `.env.local` está en `.gitignore`: **las claves nunca se suben**.

---

## 2. Proyecto Supabase

1. [x] ~~Entra en https://supabase.com → **New project** (nombre `mi-dia`, región West EU). Guarda la contraseña de la base de datos en tu gestor.~~
2. [x] ~~Espera a que termine de crearse.~~

## 3. Crear las tablas

1. [x] ~~**SQL Editor** → pega `supabase/migrations/0001_init.sql` → **Run**.~~
2. [x] ~~Comprueba en **Table Editor** las 5 tablas con **RLS enabled**.~~

Qué hace ese script:
- Crea las 5 tablas del spec (+ `edited` en `day_activities` y `notifications_enabled` en `settings`).
- Activa RLS: cada usuario solo ve sus filas.
- Crea un trigger: **cuando se crea un usuario** se crean sus 4 categorías, sus ajustes y la rutina base de lunes a viernes.

> Si un usuario se creó **antes** de lanzar el script, el trigger no se ejecutó:
> ```sql
> select public.seed_user(id) from auth.users where email = 'SU_EMAIL';
> ```

## 4. Login con email y contraseña

> Sin SMTP propio Supabase no deja editar los correos, así que el login es **email + contraseña** (sin correos ni deep links).

1. [x] ~~**Authentication → Sign In / Providers → Email** activado.~~
2. [x] ~~**Authentication → Users → Add user** con tu email, contraseña nueva y **Auto Confirm User**.~~
3. [x] ~~Comprobado: `categories` 4 filas · `template_activities` 49 · `settings` 1.~~
4. [x] ~~**Registro cerrado** (*Allow new users to sign up* desactivado). Los usuarios nuevos se crean a mano (§12).~~

## 5. Conectar la app

1. [x] ~~Copiar **Project URL** y **Publishable key** (nunca la `secret` / `service_role`).~~
2. [x] ~~Crear `.env.local` con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY`.~~
3. [x] ~~`npx expo start --clear`.~~

> Sin `.env.local` la app funciona con **datos de prueba** (`src/data/mock/`).

## 6. Expo Go (solo desarrollo)

~~Uso diario con Expo Go~~ → sustituido por la PWA (§10). Para probar en nativo:
- `npx expo start` (o `--tunnel` fuera de casa) y escanear el QR con la cámara. Misma cuenta de Expo en el Mac (`npx expo login`) y en Expo Go.
- `npm run check:supabase` comprueba la conexión desde el Mac.
- Expo Go solo abre la última SDK (el proyecto está en la **58**). Cuando se actualice: `npx expo install expo@latest && npx expo install --fix`.

## 7. Notificaciones locales (solo nativo)

~~Uso diario~~ → en la PWA los avisos van por Web Push (§11). En nativo:
- Al empezar cada actividad con *Aviso*: «Hasta las HH:MM · Siguiente: X». Recordatorio de planificación el día/hora de Ajustes.
- iOS guarda 64 pendientes: se programan **hoy + mañana** y se recalculan al abrir la app o cambiar algo.
- Aparecen como de «Expo Go». Al cerrar sesión se cancelan.

## 8. Usarla sin el Mac

| Opción | Coste | Pega |
|---|---|---|
| ~~Apple Developer + EAS Build~~ | 99 €/año | El coste. |
| ~~Xcode con Apple ID gratis~~ | 0 € | Caduca a los 7 días. |
| ~~Seguir con Expo Go~~ | 0 € | El Mac encendido con el servidor. |
| **PWA en Vercel** ✅ | 0 € | Sin widget ni Live Activity. |

**Decisión (9-11-2026): app web instalable (PWA) en Vercel.** Ver §10.

## 9. Migraciones de Supabase

- [x] ~~`0001_init.sql`~~
- [x] ~~`0002_apply_day_changes.sql`: añadir evento, restaurar día y aplicar rutina en una sola transacción.~~
- [x] ~~`0003_web_push.sql` + función `push` + `0004_push_cron.sql` (§11).~~

Para las siguientes: `npx supabase db query --remote=bnqxmgtpqwhaztvpneyx --yes -f supabase/migrations/000X_….sql` (requiere `npx supabase login` en la app Terminal).

## 10. Versión web (PWA) en Vercel

La misma app se compila para la web y se sirve gratis en Vercel. **Cada `git push` a `main` la publica.**

**Configuración (hecha):**
1. [x] ~~Vercel → importar `mi-dia-app` (framework *Other*; build y salida en `vercel.json`).~~
2. [x] ~~**Environment Variables:** `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` como **Config**, no *Secret* (Vercel no admite *Secret* con prefijo público; además, estos valores van dentro de la app).~~
3. [x] ~~Deploy → https://mi-dia-app-seven.vercel.app~~

**En el iPhone:** Safari → Compartir → **Añadir a pantalla de inicio** → iniciar sesión una vez. Si cambia el icono, hay que borrarla y volver a añadirla.

**Diferencias con la versión nativa:**
- Avisos por Web Push (§11).
- Diálogos de confirmación del navegador (`src/lib/alert.web.ts`).
- Selector de hora `<input type="time">` (`src/components/TimePicker.web.tsx`).
- Márgenes del notch e indicador de inicio por CSS (`public/index.html` + `WebSafeArea.web.tsx`); en modo app instalada `#root` toma el alto de la pantalla.

**Sin conexión:** el service worker (`public/sw.js`) guarda la app (~4 MB). En cada build, `scripts/build-sw.mjs` mete en `dist/sw.js` la versión y la lista de archivos. La versión nueva se descarga sola la siguiente vez que se abre con conexión.

**Probar en local:** `npx expo export -p web && node scripts/build-sw.mjs && npx serve -s dist`.

## 11. Avisos en la versión web (Web Push)

```
pg_cron (cada minuto) → Edge Function `push` → claim_due_push() → Web Push → service worker → aviso
```

- `0003_web_push.sql`: `push_subscriptions` (un dispositivo por fila), `push_log` (avisos enviados, para no repetir) y `claim_due_push()` (mismas reglas que `src/domain/notifications.ts`).
- `supabase/functions/push/index.ts`: envía lo pendiente (cron, cabecera `x-cron-secret`) o una prueba (botón de Ajustes, con la sesión del usuario). Borra suscripciones caducadas.
- `0004_push_cron.sql`: job `mi-dia-push` (`pg_cron` + `pg_net`); lee el secreto de Vault (`push_cron_secret`).
- Cliente: `src/notifications/webPush.ts` y `src/components/WebPushSettings.web.tsx`.

**Puesta en marcha (hecha):**
1. [x] ~~Ejecutar `0003_web_push.sql`.~~
2. [x] ~~`npx supabase functions deploy push --remote=bnqxmgtpqwhaztvpneyx --no-verify-jwt --use-api`.~~
3. [x] ~~Secretos: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`https://mi-dia-app-seven.vercel.app`), `CRON_SECRET`.~~
4. [x] ~~`select vault.create_secret('<CRON_SECRET>', 'push_cron_secret');` y `0004_push_cron.sql`.~~
5. [x] ~~En el iPhone: Ajustes → «Activar avisos en este dispositivo» → prueba → aviso real comprobado (sale una sola vez).~~

**Si hubiera que regenerar las claves VAPID** (no se guarda copia fuera de Supabase): `npx web-push generate-vapid-keys`, cambiar la pública en `src/notifications/webPush.ts`, subir los secretos nuevos y volver a pulsar «Activar avisos» en cada dispositivo.

**Tests:** `npm run test:sql` (PGlite) comprueba que `claim_due_push()` avisa igual que la app.

**Comprobar el cron:** `select * from cron.job_run_details order by start_time desc limit 5;` y `select status_code, content from net._http_response order by created desc limit 5;`

## 12. Añadir usuarios

El registro está cerrado: cada usuario se crea a mano y tiene **sus propios datos** (RLS). Al crearlo, el trigger le genera categorías, ajustes y la rutina base de ejemplo, que luego cambia desde la pestaña Rutina.

1. [ ] **Authentication → Users → Add user → Create new user**: su email y una contraseña inicial; marca **Auto Confirm User**.
2. [ ] Comprueba en **Table Editor → `settings`** que hay una fila nueva con su `user_id`.
3. [ ] Pásale la URL y la contraseña por un canal privado. En su iPhone: Safari → Añadir a pantalla de inicio → entrar → Ajustes → «Activar avisos en este dispositivo».

**Rutina propia desde el principio** (en vez de la de ejemplo): crear el usuario, sustituir sus filas de `template_activities` por SQL antes de que entre (si ya entró y no ha marcado nada, borrar sus `weeks` para que la app las regenere).

> La app aún no tiene «cambiar contraseña». Si la quiere cambiar: **Authentication → Users → ⋯ → Reset password** o se añade la opción en Ajustes.

## 13. Google Calendar → Mi Día (issue #1)

```
Google ──aviso──> gcal-webhook ─┐
pg_cron cada 15 min ──> gcal-sync ─┼─> google_events ─> rebuildDay ─> day_activities ─(Realtime)─> app
Ajustes ──> gcal-oauth (conectar / estado / desconectar)
```

Solo para los usuarios de `GCAL_ALLOWED_USER_IDS`; al resto no les aparece la sección en Ajustes.

**Google Cloud** (proyecto «Mi Dia», `mi-dia-514216`):
1. [x] ~~API de Google Calendar activada.~~
2. [x] ~~Pantalla de permisos: externa, dominio `mi-dia-app-seven.vercel.app`, privacidad `/privacidad.html`, permisos `calendar.readonly` y email.~~
3. [ ] **Público → Publicar app** (en «Prueba» Google corta la conexión cada 7 días). Sin verificar sale un aviso al conectar: «Google no ha verificado esta app» → Configuración avanzada → Ir a Mi Día.
4. [ ] **Clientes → Crear cliente → Aplicación web**. URI de redirección: `https://mi-dia-app-seven.vercel.app/api/gcal/callback` (Vercel la reenvía a la función `gcal-oauth`). Descargar el JSON (no pegar el secreto en ningún chat).

**Supabase:**
5. [ ] Ejecutar `0005_google_calendar.sql`.
6. [ ] Secretos (Edge Functions → Secrets): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (del JSON), `GCAL_STATE_SECRET` (`openssl rand -base64 32`), `GCAL_ALLOWED_USER_IDS` (tu `user_id`), `APP_URL` = `https://mi-dia-app-seven.vercel.app`. `CRON_SECRET` ya está (el de `push`).
7. [ ] Desplegar: `for f in gcal-oauth gcal-sync gcal-webhook; do npx supabase functions deploy $f --remote=bnqxmgtpqwhaztvpneyx --no-verify-jwt --use-api; done`
8. [ ] Ejecutar `0006_gcal_cron.sql` (usa el `push_cron_secret` de Vault).
9. [ ] En el iPhone: Ajustes → Google Calendar → **Conectar con Google**. Comprobar que «Charanga Jaleo» (Música) y «Running» (Salud) salen activos.

**Comprobar:** crear un evento hoy en Google → aparece en ≤ 30 s. Moverlo → la rutina vuelve en el hueco. Logs: Supabase → Edge Functions → `gcal-sync` / `gcal-webhook` → Logs.

**Si se cambia algo de `src/domain/`:** `npm run build:functions` y volver a desplegar las tres funciones (`npm test` avisa si el paquete está desactualizado).

**Quitarlo:** Ajustes → Desconectar; `select cron.unschedule('mi-dia-gcal-sync');`. La migración es aditiva (`external_id` admite nulos).
