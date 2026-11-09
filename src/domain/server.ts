// Lo que usan las Edge Functions (Deno). `npm run build:functions` lo empaqueta en
// supabase/functions/_shared/domain.js. No importar nada de React Native aquí.

export { localNow } from './clock';
export { externalId, eventRows, planEventsSync, syncWindow, toDayPieces } from './googleEvents';
export type { EventsSyncPlan, GoogleApiEvent, GoogleCalendarConfig, GoogleEventRow, SyncWindow } from './googleEvents';
export { rebuildDay } from './rebuildDay';
export { addDays, compareDates, normalizeTime, weekDates, weekStartOf } from './time';
