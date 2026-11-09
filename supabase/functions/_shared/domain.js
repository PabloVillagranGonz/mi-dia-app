// GENERADO por scripts/build-functions.mjs desde src/domain/. NO EDITAR.
// domain-hash: 06cfc69f217e9066
// src/domain/clock.ts
var TIMEZONE = "Europe/Madrid";
var formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});
function localNow(now = /* @__PURE__ */ new Date()) {
  const parts = {};
  for (const p of formatter.formatToParts(now)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    seconds: Number(parts.second)
  };
}
function zonedToInstant(date, minutes) {
  const [y, m, d] = date.split("-").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = wallAsUtc - offsetMinutes(new Date(wallAsUtc)) * 6e4;
  guess = wallAsUtc - offsetMinutes(new Date(guess)) * 6e4;
  return new Date(guess);
}
function offsetMinutes(instant) {
  const l = localNow(instant);
  const [y, m, d] = l.date.split("-").map(Number);
  const localAsUtc = Date.UTC(y, m - 1, d, 0, l.minutes, l.seconds);
  return Math.round((localAsUtc - Math.floor(instant.getTime() / 1e3) * 1e3) / 6e4);
}

// src/domain/time.ts
var DAY_MINUTES = 24 * 60;
function toMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!m) throw new Error(`Hora no v\xE1lida: ${time}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || h === 24 && min !== 0) throw new Error(`Hora no v\xE1lida: ${time}`);
  return h * 60 + min;
}
function fromMinutes(total) {
  if (!Number.isInteger(total) || total < 0 || total > DAY_MINUTES) {
    throw new Error(`Minutos fuera de rango: ${total}`);
  }
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function normalizeTime(time) {
  return fromMinutes(toMinutes(time));
}
function parseDate(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Fecha no v\xE1lida: ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
function formatDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(date, days) {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}
function weekdayOf(date) {
  const js = parseDate(date).getUTCDay();
  return js === 0 ? 7 : js;
}
function weekStartOf(date) {
  return addDays(date, 1 - weekdayOf(date));
}
function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
function compareDates(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// src/domain/googleEvents.ts
var UNTITLED = "(Sin t\xEDtulo)";
var externalId = (calendarId, eventId) => `gcal:${calendarId}:${eventId}`;
function toDayPieces(event) {
  if (event.status === "cancelled") return [];
  const s = event.start?.dateTime;
  const e = event.end?.dateTime;
  if (!s || !e) return [];
  const start = localNow(new Date(s));
  const end = localNow(new Date(e));
  if (new Date(e).getTime() <= new Date(s).getTime()) return [];
  const out = [];
  for (let d = start.date; compareDates(d, end.date) <= 0; d = addDays(d, 1)) {
    const from = d === start.date ? start.minutes : 0;
    const to = d === end.date ? end.minutes : 24 * 60;
    if (to > from) out.push({ date: d, start_time: fromMinutes(from), end_time: fromMinutes(to) });
  }
  return out;
}
function eventRows(calendarId, event, window) {
  return toDayPieces(event).filter((p) => compareDates(p.date, window.from) >= 0 && compareDates(p.date, window.to) <= 0).map((p) => ({
    calendar_id: calendarId,
    event_id: event.id,
    ...p,
    title: event.summary?.trim() || UNTITLED,
    updated: event.updated ?? (/* @__PURE__ */ new Date(0)).toISOString()
  }));
}
function syncWindow(today) {
  const from = weekStartOf(today);
  const after = addDays(from, 14);
  return {
    from,
    to: addDays(after, -1),
    timeMin: zonedToInstant(from, 0).toISOString(),
    timeMax: zonedToInstant(after, 0).toISOString()
  };
}
var rowKey = (r) => `${r.event_id}|${r.date}`;
function planEventsSync(calendarId, current, items, full, window) {
  const touched = new Set(items.map((i) => i.id));
  const desired = items.flatMap((i) => eventRows(calendarId, i, window));
  const desiredKeys = new Set(desired.map(rowKey));
  const currentByKey = new Map(current.map((r) => [rowKey(r), r]));
  const remove = current.filter((r) => {
    const outside = compareDates(r.date, window.from) < 0 || compareDates(r.date, window.to) > 0;
    if (outside) return true;
    if (full || touched.has(r.event_id)) return !desiredKeys.has(rowKey(r));
    return false;
  }).map(({ event_id, date }) => ({ event_id, date }));
  const upsert = desired.filter((d) => {
    const c = currentByKey.get(rowKey(d));
    return !c || c.start_time !== d.start_time || c.end_time !== d.end_time || c.title !== d.title;
  });
  return { upsert, remove };
}
function stableUuid(text) {
  const parts = [2166136261, 16777619, 2654435769, 2246822507].map((seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  });
  const hex = parts.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// src/domain/intervals.ts
var toRange = (s) => ({ start: toMinutes(s.start_time), end: toMinutes(s.end_time) });
var fromRange = (r) => ({ start_time: fromMinutes(r.start), end_time: fromMinutes(r.end) });
function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}
function subtractRange(base, cut) {
  if (!rangesOverlap(base, cut)) return [base];
  const out = [];
  if (cut.start > base.start) out.push({ start: base.start, end: cut.start });
  if (cut.end < base.end) out.push({ start: cut.end, end: base.end });
  return out;
}
function subtractRanges(base, cuts) {
  let pieces = [base];
  for (const cut of cuts) pieces = pieces.flatMap((p) => subtractRange(p, cut));
  return pieces;
}

// src/domain/rebuildDay.ts
function mergeRanges(ranges) {
  const sorted = [...ranges].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}
function intersect(a, b) {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
}
var isGoogle = (a) => Boolean(a.external_id);
function draftOf(a) {
  const { id: _id, user_id: _u, week_id: _w, ...rest } = a;
  return rest;
}
function rebuildDay(input) {
  const { date, weekId, templates } = input;
  const ofDay = input.existing.filter((a) => a.date === date);
  const cfg = new Map(input.calendars.map((c) => [c.calendar_id, c]));
  const changes = { delete: [], update: [], insert: [] };
  const insert = (d) => changes.insert.push({ ...d, week_id: weekId });
  const multiDay = /* @__PURE__ */ new Set();
  const datesOf = /* @__PURE__ */ new Map();
  for (const g of input.googleEvents) {
    const k = externalId(g.calendar_id, g.event_id);
    const s = datesOf.get(k) ?? /* @__PURE__ */ new Set();
    s.add(g.date);
    datesOf.set(k, s);
    if (s.size > 1) multiDay.add(k);
  }
  const events = input.googleEvents.filter((g) => g.date === date && cfg.has(g.calendar_id)).map((g) => ({ g, ext: externalId(g.calendar_id, g.event_id), r: toRange(g) })).sort((a, b) => a.r.start - b.r.start || a.r.end - b.r.end || (a.ext < b.ext ? -1 : a.ext > b.ext ? 1 : 0));
  const placed = [];
  const desired = /* @__PURE__ */ new Map();
  for (const { g, ext, r } of events) {
    const c = cfg.get(g.calendar_id);
    subtractRanges(r, placed).forEach((piece, i) => {
      desired.set(`${ext}#${i}`, {
        date,
        ...fromRange(piece),
        title: g.title,
        category_id: c.category_id,
        kind: c.kind,
        origin: "event",
        template_activity_id: null,
        split_group_id: multiDay.has(ext) ? stableUuid(ext) : null,
        notify: c.notify,
        edited: false,
        done: false,
        done_at: null,
        note: null,
        external_id: ext
      });
    });
    placed.push(r);
  }
  const blockedByGoogle = mergeRanges(placed);
  const oldGoogle = ofDay.filter(isGoogle);
  const oldByKey = /* @__PURE__ */ new Map();
  const byExt = /* @__PURE__ */ new Map();
  for (const a of oldGoogle) byExt.set(a.external_id, [...byExt.get(a.external_id) ?? [], a]);
  for (const [ext, rows] of byExt) {
    [...rows].sort((x, y) => toRange(x).start - toRange(y).start).forEach((a, i) => oldByKey.set(`${ext}#${i}`, a));
  }
  const otherDays = /* @__PURE__ */ new Map();
  for (const a of input.existing) {
    if (a.date !== date && a.external_id && !otherDays.has(a.external_id)) otherDays.set(a.external_id, a);
  }
  const sameMeta = (a, d) => a.title === d.title && a.category_id === d.category_id && a.kind === d.kind && a.notify === d.notify && a.split_group_id === d.split_group_id && a.origin === "event";
  for (const [key, d] of desired) {
    const old = oldByKey.get(key);
    const carry = old ?? byExt.get(d.external_id)?.[0] ?? otherDays.get(d.external_id);
    const kept = carry ? { done: carry.done, done_at: carry.done_at, note: carry.note } : {};
    if (old && sameMeta(old, d)) {
      if (old.start_time !== d.start_time || old.end_time !== d.end_time) {
        changes.update.push({ id: old.id, start_time: d.start_time, end_time: d.end_time });
      }
    } else {
      if (old) changes.delete.push(old.id);
      insert({ ...d, ...kept });
    }
  }
  for (const [key, old] of oldByKey) if (!desired.has(key)) changes.delete.push(old.id);
  const freed = mergeRanges(
    mergeRanges(oldGoogle.map(toRange)).flatMap((r) => subtractRanges(r, blockedByGoogle))
  );
  const live = [];
  for (const a of ofDay.filter((x) => !isGoogle(x))) {
    const pieces = subtractRanges(toRange(a), blockedByGoogle);
    if (pieces.length === 0) changes.delete.push(a.id);
    pieces.forEach((p, i) => live.push({ id: i === 0 ? a.id : null, row: a, r: p }));
  }
  if (freed.length) {
    const represented = new Set(
      ofDay.filter((a) => a.origin === "template" && a.edited && a.template_activity_id).map((a) => a.template_activity_id)
    );
    const weekday = weekdayOf(date);
    for (const t of templates) {
      if (t.weekday !== weekday || represented.has(t.id)) continue;
      for (const f of freed) {
        const inter = intersect(toRange(t), f);
        if (!inter) continue;
        const blockers = [...blockedByGoogle, ...live.map((l) => l.r)];
        for (const piece of subtractRanges(inter, blockers)) {
          const sameTemplate = (l) => l.row.origin === "template" && !l.row.edited && l.row.template_activity_id === t.id;
          const left = live.find((l) => sameTemplate(l) && l.r.end === piece.start);
          const right = live.find((l) => sameTemplate(l) && l.r.start === piece.end);
          if (left) {
            left.r = { start: left.r.start, end: right ? right.r.end : piece.end };
            if (right) live.splice(live.indexOf(right), 1).forEach((x) => x.id && changes.delete.push(x.id));
          } else if (right) {
            right.r = { start: piece.start, end: right.r.end };
          } else {
            live.push({
              id: null,
              r: piece,
              row: {
                id: "",
                user_id: "",
                week_id: weekId,
                date,
                start_time: t.start_time,
                end_time: t.end_time,
                title: t.title,
                category_id: t.category_id,
                kind: t.kind,
                origin: "template",
                template_activity_id: t.id,
                split_group_id: t.split_group_id,
                notify: t.notify,
                edited: false,
                done: false,
                done_at: null,
                note: null,
                external_id: null
              }
            });
          }
        }
      }
    }
  }
  for (const l of live) {
    const slot = fromRange(l.r);
    if (l.id) {
      if (slot.start_time !== l.row.start_time || slot.end_time !== l.row.end_time) {
        changes.update.push({ id: l.id, ...slot });
      }
    } else {
      insert({ ...draftOf(l.row), ...slot });
    }
  }
  return changes;
}
export {
  addDays,
  compareDates,
  eventRows,
  externalId,
  localNow,
  normalizeTime,
  planEventsSync,
  rebuildDay,
  syncWindow,
  toDayPieces,
  weekDates,
  weekStartOf
};
