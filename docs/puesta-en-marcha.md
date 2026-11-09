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

## 8. Más adelante: EAS Update

Para usar la app sin tener el Mac encendido con `expo start`:

1. `npm i -g eas-cli` → `eas login` (cuenta gratuita de Expo).
2. `eas update:configure`.
3. Cada vez que quieras publicar: `eas update --branch main --message "lo que sea"`.
4. En Expo Go, la app aparece en tu perfil y carga la última versión publicada.

Lo dejaremos montado cuando la app esté estable.
