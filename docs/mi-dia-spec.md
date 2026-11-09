# Mi Día — Especificación Fase 1

App móvil personal: muestra qué toca hacer en cada momento del día según una rutina base, con planificación semanal los domingos.
Este documento junta todas las decisiones tomadas. La interfaz sale de Emergent y la lógica se implementa con Claude Code a partir de aquí.

---

## 1. Stack

| Pieza | Elección |
|---|---|
| App | Expo SDK 58 + **TypeScript** + **Expo Router**. Se usa como **app web instalable (PWA)**; el mismo código sigue compilando para nativo. |
| Backend | **Supabase** (Postgres + Auth), usado directamente desde la app con `@supabase/supabase-js`. Sin servidor propio. |
| Auth | **Email + contraseña** (usuario creado a mano en Supabase, registro cerrado). Sin magic link ni OTP: el correo por defecto de Supabase solo manda enlaces y los deep links en Expo Go dan problemas. Sesión persistida en AsyncStorage → login una sola vez. |
| Notificaciones | **Web (PWA, uso diario):** Web Push enviado por Supabase (pg_cron cada minuto → Edge Function `push`). **Nativo:** `expo-notifications` locales. Ver §4.5. |
| Instalación | **PWA en Vercel** (gratis): `git push` a `main` publica; en el iPhone, Safari → «Añadir a pantalla de inicio». Expo Go queda solo para desarrollo. Ver `docs/puesta-en-marcha.md` §4. |
| Zona horaria | `Europe/Madrid`. Formato 24 h. Semana de **lunes a domingo**. Todo el texto en español. |

**Por qué PWA y no app nativa (decisión del 9-11-2026):** instalar una app nativa en el iPhone de forma permanente exige la cuenta de Apple Developer (99 €/año); con Apple ID gratis caduca cada 7 días y Expo Go necesita el Mac encendido. La PWA es gratis, se actualiza sola y admite avisos (Web Push, iOS 16.4+). Lo que se pierde: widget y Live Activity.

**Aviso Expo Go (solo desarrollo):** solo soporta la SDK más reciente. Cuando Expo Go se actualice, habrá que subir el proyecto de versión para seguir probando en nativo.

**Conexión:** en la Fase 1 la app necesita internet para escribir. Se guarda en caché la última lectura de hoy y de la semana (AsyncStorage; en la web, localStorage) para poder consultarlas sin conexión. En la web, el service worker guarda además la propia app, así que abre aunque no haya conexión.

---

## 2. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Persistencia | Supabase en la nube, con RLS por usuario |
| Rutina base | **Una plantilla por día de la semana (L, M, X, J, V, S, D)** con acción «Copiar este día a…». Sábado y domingo empiezan vacíos. |
| Semana sin planificar | Al abrir la app, si la semana actual no existe → se **genera automáticamente desde la rutina base** |
| Editar rutina base | Al guardar, **pregunta**: «¿Aplicar también a los días que quedan de esta semana?» (y a la semana siguiente si ya está planificada) |
| Cruce de medianoche | La actividad **se parte en dos** automáticamente (día N: inicio–24:00 / día N+1: 00:00–fin), enlazadas por `split_group_id` |
| Huecos | Se muestran como **«Tiempo libre»** con cuenta atrás hasta la próxima actividad. No se guardan: se calculan. |
| Progreso | Solo cuentan las actividades de tipo **tarea**; las **fijas** no cuentan |
| Categorías | Cuatro de base, **editables** (nombre y color) y se pueden crear más |
| Solapes | **No se permiten**: se valida al guardar (rutina base, ajustes del día y actividades manuales) |
| Eventos puntuales | **Recortan o sustituyen** la rutina de ese día (ver reglas) |
| Notas | Por actividad y **solo de ese día**. Quedan guardadas en el historial. |
| Historial | Días y semanas pasados en **solo lectura** |
| Notificaciones | **En la Fase 1**: aviso al inicio de cada actividad (activable por actividad) + recordatorio de planificación los **domingos a las 20:00** |
| Ensayos (La Liga, charanga…) | **No van en la rutina base**: se añaden como evento puntual cada domingo |
| Conservatorio | Tipo **tarea** (suma al progreso) |

### Decisiones que he tomado yo (revisables)
- **Copiar la semana anterior** copia actividades y ajustes de horario, pero **no** los eventos puntuales, el estado de hecho ni las notas.
- **Notificación activada por defecto** en todas las actividades salvo «Dormir».
- **«Aplicar a esta semana»** afecta a los días a partir de **mañana**. Hoy no se toca para no romper lo ya marcado.

### Decisiones del 9-11-2026
- **Dispositivo:** iPhone, como PWA en la pantalla de inicio (antes Expo Go). Expo SDK 58.
- **Ajustes manuales se respetan:** una actividad de un día con el horario/título cambiado a mano se marca `edited = true` y «Aplicar rutina base» no la sobrescribe.
- **Copiar la semana anterior** regenera desde la rutina base las actividades `origin = 'template'` no editadas (así no se arrastran los recortes de eventos que no se copian) y copia tal cual las `manual` y las `template` con `edited = true`.
- **Fin de semana vacío**, también la noche del viernes al sábado (sin «Dormir»).
- **Login con email + contraseña** en lugar de OTP: editar las plantillas de correo de Supabase exige SMTP propio.

---

## 3. Modelo de datos (Supabase / Postgres)

Las horas de planificación se guardan como `time` (hora local) + `date`, **nunca como timestamps**, para evitar problemas con el cambio de hora. `time` admite `24:00`.

```sql
-- Categorías
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null,            -- hex
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Rutina base: una fila por actividad y día de la semana
create table template_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),  -- 1 = lunes … 7 = domingo
  start_time time not null,
  end_time time not null,          -- > start_time (los cruces de medianoche ya vienen partidos)
  title text not null,
  category_id uuid references categories on delete set null,
  kind text not null check (kind in ('task','fixed')),
  notify boolean not null default true,
  split_group_id uuid,             -- enlaza las dos mitades de una actividad que cruza medianoche
  created_at timestamptz default now()
);

-- Semanas generadas
create table weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  week_start date not null,        -- siempre lunes
  source text not null check (source in ('base','copy','auto')),
  planned_at timestamptz default now(),
  unique (user_id, week_start)
);

-- Actividades concretas de cada día (copia independiente de la plantilla)
create table day_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  week_id uuid not null references weeks on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  title text not null,
  category_id uuid references categories on delete set null,
  kind text not null check (kind in ('task','fixed')),
  origin text not null check (origin in ('template','event','manual')),
  template_activity_id uuid references template_activities on delete set null,
  split_group_id uuid,
  notify boolean not null default true,
  edited boolean not null default false,   -- ajustada a mano ese día
  done boolean not null default false,
  done_at timestamptz,
  note text,
  created_at timestamptz default now()
);
create index on day_activities (user_id, date);

-- Ajustes
create table settings (
  user_id uuid primary key references auth.users on delete cascade,
  planning_reminder_weekday smallint not null default 7,
  planning_reminder_time time not null default '20:00',
  notifications_enabled boolean not null default true,
  timezone text not null default 'Europe/Madrid'
);
```

**RLS** en todas las tablas: `using (user_id = auth.uid()) with check (user_id = auth.uid())`.
Al registrarse el usuario se crean sus categorías base, sus ajustes y la rutina inicial (sección 6).

---

## 4. Reglas de negocio

### 4.1 Generar una semana
- **Desde la base:** para cada día de lunes a domingo, copia en `day_activities` las `template_activities` de su `weekday` (`origin = 'template'`).
- **Copiando la anterior:** copia las `day_activities` de la semana previa con `origin = 'manual'` o (`origin = 'template'` y `edited = true`), con la fecha +7 días, `done = false` y `note = null`. El resto de cada día se rellena desde la rutina base sin solapar con lo copiado. Los eventos no se copian.
- **Auto:** al abrir la app (y al volver a primer plano), si no existe la semana actual → se genera desde la base con `source = 'auto'`.
- La planificación del domingo genera **la semana siguiente**.

### 4.2 Eventos puntuales
Al añadir un evento (`origin = 'event'`) en un día:
1. Las actividades de ese día que queden **totalmente cubiertas** se eliminan.
2. Las que se solapen **por un extremo** se recortan.
3. Si el evento cae **en medio** de una actividad, esa actividad se parte en dos trozos (antes y después).
4. Dos eventos no pueden solaparse entre sí (validación).
Al borrar un evento, el hueco se queda como «Tiempo libre» (no se restaura la rutina). La UI ofrece «Restaurar rutina de este día».

### 4.2 bis Eventos de Google Calendar (issue #1, solo administrador)
- **Solo Google → Mi Día.** Calendarios elegidos en Ajustes (cada uno con su categoría); `kind = 'task'`, `notify = true`. Ventana: semana actual + siguiente. Los de todo el día no se traen.
- Se guardan en `google_events` (una fila por evento y día) y se materializan en `day_activities` como `origin = 'event'` con `external_id = 'gcal:<calendario>:<evento>'`. En la app son de solo lectura: solo «hecha» y nota.
- **Siempre gana Google:** recorta la rutina, los eventos manuales y las actividades sueltas. Entre dos de Google gana el que empieza antes. Un evento manual que pisa uno de Google se recorta a su alrededor.
- **Mover o borrar en Google** rellena con la rutina base **solo** el tramo que deja libre (lo que se borró a mano ese día fuera de ese tramo no vuelve). La fila del evento conserva hecho y nota si se mueve dentro del mismo día.
- **Rapidez:** Google avisa a `gcal-webhook` (≤ 30 s, la app abierta se refresca por Realtime). Respaldo: `gcal-sync` cada 15 min, que también renueva los canales y hace el sync completo al cambiar de semana.
- Una semana que aún no existe recibe sus eventos de Google al generarse (`ensureWeek`/`planWeek`). Los días pasados no se tocan.
- **Desconectar:** revoca el permiso, borra `google_*` y restaura la rutina de hoy en adelante.
- Lógica pura: `src/domain/googleEvents.ts` (`toDayPieces`, `planEventsSync`) y `src/domain/rebuildDay.ts`, empaquetada para las Edge Functions con `npm run build:functions`.

### 4.3 Editar la rutina base
- Validación de solapes dentro del mismo `weekday`.
- Si `end_time < start_time` → se parte en dos filas (día N y día N+1, con domingo → lunes) y se les asigna un `split_group_id`. Editar o borrar una mitad afecta a las dos.
- Al guardar, un diálogo: **«Solo próximas semanas»** / **«También el resto de esta semana»** (+ la semana siguiente si ya está planificada). Aplicarlo sustituye las actividades `origin = 'template'` con `edited = false` de esos días a partir de mañana, conserva `event`, `manual` y las editadas y vuelve a aplicar los recortes de 4.2.

### 4.4 Vista Hoy
- **AHORA**: actividad con `start_time <= ahora < end_time`. Se refresca cada 30 s y al volver a primer plano.
- **Hueco**: bloque «Tiempo libre» calculado + «Siguiente: X en 25 min».
- **Progreso del día**: `tareas hechas / total de tareas` del día. Las fijas no cuentan.
- **Check-off** y **nota** solo para hoy. Días anteriores en solo lectura. Días futuros: se pueden editar horarios y notas, pero no marcar como hecho.

### 4.5 Notificaciones
- Al inicio de cada actividad con `notify = true`: título = nombre de la actividad; cuerpo = «Hasta las HH:MM · Siguiente: X».
- **Web (PWA):** las envía el servidor. `pg_cron` llama cada minuto a la Edge Function `push`, que usa `claim_due_push()` (SQL, mismas reglas que `src/domain/notifications.ts`, comprobado con `npm run test:sql`) y manda Web Push a cada dispositivo suscrito. Cada aviso se registra en `push_log` para no repetirlo. Se activan por dispositivo desde Ajustes («Activar avisos en este dispositivo»); en iPhone solo con la app abierta desde la pantalla de inicio.
- **Nativo:** notificaciones locales. iOS solo admite **64 pendientes** → se programan en ventana móvil (hoy + mañana) y se reprograman al abrir la app, al volver a primer plano y tras cualquier cambio.
- Recordatorio semanal: **domingo 20:00**, «Planifica tu semana». Al tocarlo abre `/planificar`.
- Si es domingo y la semana siguiente no está planificada → banner en la vista Hoy.

---

## 5. Pantallas

Barra inferior: **Hoy · Semana · Rutina · Ajustes**

| Pantalla | Contenido |
|---|---|
| **Login** | Email + contraseña. Solo la primera vez. |
| **Hoy** (principal) | Cabecera con fecha y barra de progreso. Tarjeta grande «AHORA» (actividad, hora de fin, tiempo restante) y «Siguiente». Línea de tiempo vertical del día con los bloques coloreados por categoría y los huecos en gris. Tocar un bloque abre una hoja inferior con: marcar hecho, nota y editar horario de hoy. Botón «+» para añadir evento o actividad. |
| **Semana** | 7 columnas o tarjetas (L–D) con los bloques del día en miniatura, progreso por día y de la semana, flechas para semana anterior/siguiente (las pasadas en solo lectura). Botón «Planificar semana siguiente». |
| **Planificar** (asistente) | 1) Elegir origen: rutina base / copiar la semana actual. 2) Revisar día a día y añadir eventos (ensayos, bolos, citas) y ajustes. 3) Confirmar. |
| **Rutina** | Pestañas L M X J V S D. Lista de actividades del día con hora, categoría, tipo (tarea/fija) y aviso. Crear / editar / borrar. Acción «Copiar este día a…» (selector de días). Acceso a la gestión de categorías. |
| **Categorías** | Lista editable: nombre, color (paleta) y orden. Crear nuevas. |
| **Ajustes** | Hora del recordatorio dominical, notificaciones activadas/desactivadas, cerrar sesión. |

### Diseño
Modo oscuro, tipo panel de control.
- Paleta, tipografía y acento: **los de las capturas de Emergent** (sección 8). Fondo casi negro, tarjetas `#1A1D24`, acento naranja `#D9603B`.
- Tipografía grande y legible: hora actual y AHORA en grande.
- Colores por categoría (sección 6). «Tiempo libre» en gris `#3A4150` con trazo discontinuo.
- Animaciones sutiles: pulso suave en el bloque AHORA, transición al marcar como hecho, barra de progreso animada.

---

## 6. Datos iniciales

### Categorías
| Nombre | Color |
|---|---|
| Trabajo / estudio | `#4F8CFF` |
| Música | `#B07CFF` |
| Salud | `#34D399` |
| Personal | `#F5B544` |

Los eventos puntuales usan una categoría a elegir (por defecto Personal).

### Rutina base — común de lunes a viernes
| Hora | Actividad | Categoría | Tipo | Aviso |
|---|---|---|---|---|
| 00:30–09:00 | Dormir | Salud | fija | no |
| 09:00–09:30 | Despertar y desayuno | Salud | fija | sí |
| 09:30–10:30 | Deporte | Salud | tarea | sí |
| 10:30–12:30 | Programar / proyectos | Trabajo / estudio | tarea | sí |
| 12:30–13:30 | Practicar instrumento | Música | tarea | sí |
| 13:30–14:00 | Casa y recados | Personal | tarea | sí |
| 14:00–16:00 | Comida y descanso | Salud | fija | sí |
| 21:30–22:30 | Cena | Salud | fija | sí |

(22:30–00:30 queda como tiempo libre calculado)

### Tardes por día
| Día | Hora | Actividad | Categoría | Tipo |
|---|---|---|---|---|
| Lunes | 16:00–18:00 | Practicar instrumento | Música | tarea |
| Lunes | 18:00–20:00 | Programar / proyectos | Trabajo / estudio | tarea |
| Martes | 16:00–20:00 | Conservatorio | Música | tarea |
| Miércoles | 16:00–17:30 | Practicar instrumento | Música | tarea |
| Miércoles | 17:30–19:00 | Programar / proyectos | Trabajo / estudio | tarea |
| Miércoles | 19:30–21:00 | Conservatorio | Música | tarea |
| Jueves | 16:00–18:00 | Practicar instrumento | Música | tarea |
| Jueves | 18:00–20:00 | Deporte / ocio | Personal | tarea |
| Viernes | 16:00–20:00 | Conservatorio | Música | tarea |

### Sábado y domingo
Vacíos (todo «Tiempo libre»). Se rellenan a mano o con eventos en la planificación.

---

## 7. Reparto Emergent / Claude Code

**Emergent (interfaz):**
- Proyecto **Expo + TypeScript + Expo Router**, no web. Comprobarlo al empezar.
- Todas las pantallas de la sección 5 con **datos de prueba con la misma forma que las tablas de la sección 3** (los datos iniciales de la sección 6).
- **Sin backend propio**: los datos vienen de una capa `src/data/` (repositorio con funciones tipo `getDay(date)`, `toggleDone(id)`…) que de momento devuelve datos de prueba.
- Componentes separados: `TimelineBlock`, `NowCard`, `ProgressBar`, `ActivitySheet`, `WeekDayCard`, `CategoryChip`.

**Claude Code (lógica):**
1. Proyecto Supabase: tablas, RLS y la función de alta inicial (seed).
2. Auth con email + contraseña y persistencia de la sesión.
3. Cambiar la capa `src/data/` de datos de prueba a Supabase (+ caché de lectura).
4. Reglas de la sección 4: generar semanas, eventos con recorte, medianoche, solapes y aplicar cambios de la base.
5. Notificaciones locales con ventana móvil + recordatorio dominical (nativo) y Web Push desde Supabase (web).
6. ~~EAS Update para usarla desde Expo Go~~ → sustituido por la PWA en Vercel.
7. Tests unitarios de las funciones puras: recorte de eventos, partir en medianoche, detección de solapes, cálculo de huecos y progreso.

---

## 8. Referencia visual (capturas de Emergent)

Las capturas están en `docs/diseno/`:

| Archivo | Pantalla |
|---|---|
| `docs/diseno/01-hoy.png` | Vista Hoy: cabecera, progreso, próxima actividad y línea de tiempo |
| `docs/diseno/02-editar-actividad.png` | Hoja inferior para editar una actividad |
| `docs/diseno/03-rutina-base.png` | Rutina base |

**Se toma de las capturas:** el estilo visual (fondo casi negro, tarjetas `#1A1D24`, acento naranja `#D9603B`, tipografía condensada en títulos), la estructura de la vista Hoy, la línea de tiempo con puntos y hora a la izquierda, el check redondo, la hoja inferior de edición y la barra de pestañas.

**Manda esta especificación, no las capturas, en todo esto:**
- **Falta la tarjeta AHORA.** Debe ir encima de «Próxima», más grande, con tiempo restante y pulso suave. El bloque actual también se resalta en la línea de tiempo.
- **Rutina base:** pestañas **L M X J V S D** en lugar de «Entre semana / Fin de semana», más la acción «Copiar este día a…».
- **Categorías:** Trabajo / estudio, Música, Salud y Personal (sección 6), editables. En las capturas salen Ocio y Otros y falta Música.
- **«Tiempo libre» no es una actividad:** es un hueco calculado, en gris y con trazo discontinuo.
- **Hoja de edición:** añadir el selector **Tarea / Fija** y el interruptor **Aviso**. Placeholder de la nota: «Nota para hoy…» (las notas son por día, no por semana). Título de la hoja: «Editar actividad».
- **Progreso:** cuenta solo las tareas. El texto pasa a ser «3 de 8 tareas hechas».
- **Datos de prueba:** usar la rutina real de la sección 6, no la genérica de 07:00 y trabajo de 08:00 a 14:00.
- **Falta la pestaña Ajustes** en la barra inferior.

---

## 9. Fuera de la Fase 1
- ~~Sincronización con Google Calendar~~ → hecha (§4.2 bis, issue #1).
- Modo offline completo con escritura.
- Estadísticas históricas (rachas, horas por categoría), en un panel **`/admin`** solo para el administrador, desde el que también se podrán compartir cosas con los usuarios (más adelante).
- Varios usuarios: cada uno con sus datos (RLS); se dan de alta a mano en Supabase (registro cerrado).
- Widget de iOS / Live Activity con la actividad actual (requiere build nativa y cuenta de Apple Developer; no es posible en la PWA).
