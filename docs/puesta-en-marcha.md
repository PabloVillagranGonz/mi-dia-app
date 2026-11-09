# Puesta en marcha — Supabase, app en el iPhone y notificaciones

Pasos en orden. Marca cada uno al terminarlo.

---

## 1. Repositorio

- [ ] Ya está inicializado en local con el remoto `https://github.com/PabloVillagranGonz/mi-dia-app.git`.
- [ ] Primer commit y `git push -u origin main` (cuando revises la estructura).
- `.env.local` está en `.gitignore`: **las claves nunca se suben**.

---

## 2. Proyecto Supabase

1. [ ] Entra en https://supabase.com → **New project**.
   - Nombre: `mi-dia`.
   - Región: **Central EU (Frankfurt)** o **West EU (Ireland)** (la más cercana a Madrid).
   - Contraseña de la base de datos: guárdala en tu gestor de contraseñas (no la necesita la app).
2. [ ] Espera a que termine de crearse (1–2 min).

## 3. Crear las tablas

1. [ ] Menú izquierdo → **SQL Editor** → **New query**.
2. [ ] Pega **entero** el contenido de `supabase/migrations/0001_init.sql` y pulsa **Run**.
3. [ ] Comprueba en **Table Editor** que existen: `categories`, `template_activities`, `weeks`, `day_activities`, `settings`, y que todas muestran el candado de **RLS enabled**.

Qué hace ese script:
- Crea las 5 tablas del spec (+ `edited` en `day_activities` y `notifications_enabled` en `settings`).
- Activa RLS: cada usuario solo ve sus filas.
- Crea un trigger: **cuando te registras por primera vez** se crean tus 4 categorías, tus ajustes y la rutina base de lunes a viernes.

> Si creaste tu usuario **antes** de lanzar el script, el trigger no se ejecutó. Arréglalo en el SQL Editor:
> ```sql
> select public.seed_user(id) from auth.users where email = 'TU_EMAIL';
> ```

## 4. Login con código de 6 dígitos (OTP)

Por defecto Supabase manda un *enlace mágico*. Queremos un **código** (los enlaces dan problemas en Expo Go).

1. [ ] **Authentication → Sign In / Providers → Email**:
   - **Enable Email provider**: activado.
   - **Email OTP Length**: `6`.
   - **Email OTP Expiration**: `3600` (1 h) está bien.
   - Guarda.
2. [ ] **Authentication → Emails → Templates**. Edita **dos** plantillas (la primera vez se usa *Confirm signup*; las siguientes, *Magic Link*):
   - **Confirm signup**
     - Asunto: `Tu código de Mi Día`
     - Cuerpo:
       ```html
       <h2>Mi Día</h2>
       <p>Tu código de acceso es:</p>
       <p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
       ```
   - **Magic Link**: mismo asunto y mismo cuerpo.
   - Lo importante es que aparezca `{{ .Token }}` y que **no** aparezca `{{ .ConfirmationURL }}`.
3. [ ] Límite de correos: el servidor de correo incluido en Supabase manda muy pocos por hora y solo a direcciones del equipo del proyecto. Para un solo usuario (tú) basta. Si algún día no llega el código, espera unos minutos o configura un SMTP propio (Resend, por ejemplo) en **Authentication → Emails → SMTP Settings**.

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
2. [ ] En el Mac: `npm install` (solo la primera vez) y `npx expo start`.
3. [ ] Con el iPhone en la **misma wifi** que el Mac, escanea el QR con la **cámara** → se abre en Expo Go.
   - Si no conecta (wifi de la universidad, de un bar…): `npx expo start --tunnel`.
4. [ ] Primer arranque: email → te llega el código → lo escribes. La sesión queda guardada; no lo volverás a pedir.
5. [ ] Comprueba en Supabase → **Table Editor → categories** que aparecen tus 4 categorías.

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
