# Puesta en marcha — Supabase, app en el iPhone y notificaciones

Pasos en orden. Marca cada uno al terminarlo.

---

## 1. Repositorio

- [x] Ya está inicializado en local con el remoto `https://github.com/PabloVillagranGonz/mi-dia-app.git`.
- [x] Primer commit y `git push -u origin main` (cuando revises la estructura).
- `.env.local` está en `.gitignore`: **las claves nunca se suben**.

---

## 2. Proyecto Supabase

1. [x] Entra en https://supabase.com → **New project**.
   - Nombre: `mi-dia`.
   - Región: **Central EU (Frankfurt)** o **West EU (Ireland)** (la más cercana a Madrid).
   - Contraseña de la base de datos: guárdala en tu gestor de contraseñas (no la necesita la app).
2. [x] Espera a que termine de crearse (1–2 min).

## 3. Crear las tablas

1. [x] Menú izquierdo → **SQL Editor** → **New query**.
2. [x] Pega **entero** el contenido de `supabase/migrations/0001_init.sql` y pulsa **Run**.
3. [x] Comprueba en **Table Editor** que existen: `categories`, `template_activities`, `weeks`, `day_activities`, `settings`, y que todas muestran el candado de **RLS enabled**.

Qué hace ese script:
- Crea las 5 tablas del spec (+ `edited` en `day_activities` y `notifications_enabled` en `settings`).
- Activa RLS: cada usuario solo ve sus filas.
- Crea un trigger: **cuando te registras por primera vez** se crean tus 4 categorías, tus ajustes y la rutina base de lunes a viernes.

> Si creaste tu usuario **antes** de lanzar el script, el trigger no se ejecutó. Arréglalo en el SQL Editor:
> ```sql
> select public.seed_user(id) from auth.users where email = 'TU_EMAIL';
> ```

## 4. Login con email y contraseña

> Cambio del 9-11-2026: sin SMTP propio Supabase no deja editar los correos y el de por defecto solo manda un enlace, así que el login es **email + contraseña** (sin correos ni deep links).

1. [x] **Authentication → Sign In / Providers → Email**: ya está activado.
2. [x] **Authentication → Users → Add user → Create new user**:
   - Tu email y una contraseña **nueva** (no la de otro servicio). Guárdala en tu gestor.
   - Marca **Auto Confirm User** (así no hace falta correo de confirmación).
3. [x] Comprueba en **Table Editor** que se ha creado tu rutina:
   - `categories` → 4 filas · `template_activities` → **49 filas** · `settings` → 1 fila.
4. [x] **Cerrar el registro** (recomendado): en **Sign In / Providers → User Signups**, desactiva **Allow new users to sign up** y pulsa **Save changes**. La clave publishable va dentro de la app, así que sin esto cualquiera que la tenga podría crearse una cuenta en tu proyecto. Tú sigues pudiendo entrar con tu usuario.

## 5. Conectar la app

1. [ ] **Project Settings → API Keys** (o el botón **Connect** de arriba). Copia:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_...`). Si tu panel solo muestra la clave **anon** (legacy), vale igual.
   - ⚠️ **Nunca** la `secret` / `service_role`: esa se salta el RLS.
2. [ ] En la raíz del proyecto, crea `.env.local`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_xxxxxxxx
   ```
3. [ ] Reinicia el servidor con caché limpia: `npx expo start --clear`.

> Mientras no exista `.env.local`, la app funciona con **datos de prueba** (`src/data/mock/`). En cuanto haya claves, usa Supabase.

## 6. Abrir la app en el iPhone (Expo Go)

1. [ ] Instala **Expo Go** desde la App Store.
2. [ ] Cuenta gratuita de Expo (https://expo.dev/signup). Inicia sesión **con la misma cuenta** en el Mac (`npx expo login`, comprobar con `npx expo whoami`) y en la app Expo Go (perfil → Log in). Sin esto Expo Go no abre el proyecto.
   - Si haces `npx expo login` con el servidor en marcha, reinícialo (`Ctrl+C` y `npx expo start`).
3. [ ] En el Mac: `npm install` (solo la primera vez) y `npx expo start`.
4. [ ] Con el iPhone en la **misma wifi** que el Mac, escanea el QR con la **cámara** → se abre en Expo Go.
   - Si no conecta (wifi de la universidad, de un bar…): `npx expo start --tunnel`.
5. [ ] Primer arranque: email + contraseña. La sesión queda guardada; no lo volverás a pedir.
6. [ ] Comprueba la conexión desde el Mac con `npm run check:supabase`.

**Aviso Expo Go:** solo abre proyectos de la última SDK. El proyecto está en la **SDK 58**. Cuando Expo Go se actualice a la siguiente, habrá que subir de versión (`npx expo install expo@latest && npx expo install --fix`).

---

## 7. Notificaciones locales

No requieren nada en Supabase ni cuenta de Apple: se programan en el propio iPhone.

### Qué hace la app
- **Al empezar cada actividad** con *Aviso* activado: título = nombre de la actividad; cuerpo = «Hasta las HH:MM · Siguiente: X».
- **Domingo a las 20:00**: «Planifica tu semana». Al tocarla abre la pantalla Planificar.
- iOS solo guarda **64 notificaciones pendientes**, así que se programan solo **hoy + mañana**. Se vuelven a calcular cada vez que abres la app, vuelves a ella o cambias algo.

### Pasos
1. [ ] La primera vez que abras la app te pedirá permiso para notificaciones → **Permitir**.
   - Si lo denegaste: **Ajustes del iPhone → Expo Go → Notificaciones → Permitir**.
2. [ ] En la app, **Ajustes → Notificaciones**: activadas.
3. [ ] Prueba: en **Ajustes** de la app habrá un botón **«Enviar notificación de prueba»** (llega en 5 s). Bloquea el móvil para verla.
4. [ ] Si no llegan: revisa que el modo **Concentración / No molestar** no silencie Expo Go.

### Limitaciones a tener en cuenta
- Las notificaciones aparecen **como de «Expo Go»**, no de «Mi Día». Eso cambia con TestFlight.
- Como solo se programan hoy + mañana, si pasas **más de un día sin abrir la app** dejarán de llegar los avisos de actividades (el recordatorio del domingo sí, porque es semanal y fijo). Abrir la app un momento cada día lo resuelve.
- Si cierras sesión, se cancelan todas.

---

## 8. Usarla sin el Mac (app instalada)

> En la SDK 58, Expo Go **solo abre updates de EAS en Android**. En iPhone, para usar la app sin `npx expo start` hace falta instalar una build propia de «Mi Día» (con su nombre e icono). Opciones:

| Opción | Coste | Cómo | Pega |
|---|---|---|---|
| **Apple Developer + EAS Build** | 99 €/año | Build en la nube de Expo (sin Xcode) → instalación directa (*internal distribution*) o TestFlight. Después, cambios por EAS Update sin reinstalar. | El coste. |
| **Xcode con Apple ID gratis** | 0 € | Compilar en el Mac con Xcode e instalar por cable en el iPhone. | Caduca a los **7 días**: hay que reinstalar desde el Mac cada semana. |
| **Seguir con Expo Go** | 0 € | `npx expo start --tunnel` | El Mac tiene que estar encendido con el servidor. |

**Decisión (nov 2026): app web instalable (PWA) en Vercel, gratis.** Ver sección 10.

## 9. Migraciones pendientes de Supabase

- [x] `supabase/migrations/0002_apply_day_changes.sql` → SQL Editor → Run. Hace que añadir un evento, restaurar un día o aplicar la rutina se guarden en una sola transacción. Comprobar con `npm run check:supabase`.

## 10. Versión web (PWA) en Vercel

La misma app se compila para la web (`npx expo export -p web` → `dist/`) y se sirve gratis en Vercel. Cada `git push` a `main` la vuelve a publicar.

**Primera vez (en vercel.com):**
1. Entrar con GitHub → **Add New… → Project** → importar `mi-dia-app`.
2. Framework: *Other*. El resto lo lee de `vercel.json` (build `npx expo export -p web`, salida `dist`).
3. **Environment Variables:** `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` (los mismos valores que `.env.local`).
4. **Deploy.** Queda en `https://<proyecto>.vercel.app`.

**En el iPhone:** abrir esa URL en **Safari** → Compartir → **Añadir a pantalla de inicio**. Se abre a pantalla completa con su icono. Iniciar sesión una vez.

**Diferencias con la versión nativa:**
- Las notificaciones aún no funcionan en la web (`src/notifications/index.web.ts` no hace nada). Siguiente paso: Web Push con Supabase Edge Functions + `pg_cron`.
- Los diálogos de confirmación usan los del navegador (`src/lib/alert.web.ts`).
- El selector de hora es `<input type="time">` (`src/components/TimePicker.web.tsx`).

**Probar en local:** `npx expo export -p web && npx serve -s dist`.
