import {
  eventRows,
  planEventsSync,
  stableUuid,
  syncWindow,
  toDayPieces,
  type GoogleApiEvent,
  type GoogleEventRow,
} from '../googleEvents';

const ev = (id: string, start: string, end: string, extra: Partial<GoogleApiEvent> = {}): GoogleApiEvent => ({
  id,
  status: 'confirmed',
  summary: id,
  updated: '2026-11-01T00:00:00Z',
  start: { dateTime: start },
  end: { dateTime: end },
  ...extra,
});

describe('toDayPieces', () => {
  test('hora de Madrid en invierno (UTC+1)', () => {
    expect(toDayPieces(ev('a', '2026-11-10T18:00:00+01:00', '2026-11-10T19:30:00+01:00'))).toEqual([
      { date: '2026-11-10', start_time: '18:00', end_time: '19:30' },
    ]);
  });

  test('evento creado en otra zona horaria se pasa a la hora de Madrid', () => {
    // 12:00 en Nueva York (UTC-5) = 18:00 en Madrid
    expect(toDayPieces(ev('a', '2026-11-10T12:00:00-05:00', '2026-11-10T13:00:00-05:00'))).toEqual([
      { date: '2026-11-10', start_time: '18:00', end_time: '19:00' },
    ]);
  });

  test('en verano (UTC+2) y en UTC', () => {
    expect(toDayPieces(ev('a', '2026-07-01T16:00:00Z', '2026-07-01T17:00:00Z'))).toEqual([
      { date: '2026-07-01', start_time: '18:00', end_time: '19:00' },
    ]);
  });

  test('día del cambio de hora (25 de octubre): 01:00 UTC son las 02:00 de Madrid', () => {
    expect(toDayPieces(ev('a', '2026-10-25T01:00:00Z', '2026-10-25T03:00:00Z'))).toEqual([
      { date: '2026-10-25', start_time: '02:00', end_time: '04:00' },
    ]);
  });

  test('cruza medianoche → dos trozos; acabar a las 00:00 → termina a las 24:00', () => {
    expect(toDayPieces(ev('a', '2026-11-10T22:00:00+01:00', '2026-11-11T01:00:00+01:00'))).toEqual([
      { date: '2026-11-10', start_time: '22:00', end_time: '24:00' },
      { date: '2026-11-11', start_time: '00:00', end_time: '01:00' },
    ]);
    expect(toDayPieces(ev('b', '2026-11-10T22:00:00+01:00', '2026-11-11T00:00:00+01:00'))).toEqual([
      { date: '2026-11-10', start_time: '22:00', end_time: '24:00' },
    ]);
  });

  test('todo el día, cancelado o de duración 0 → nada', () => {
    expect(toDayPieces({ id: 'x', start: { date: '2026-11-10' }, end: { date: '2026-11-11' } })).toEqual([]);
    expect(toDayPieces(ev('c', '2026-11-10T18:00:00+01:00', '2026-11-10T19:00:00+01:00', { status: 'cancelled' }))).toEqual([]);
    expect(toDayPieces(ev('d', '2026-11-10T18:00:00+01:00', '2026-11-10T18:00:00+01:00'))).toEqual([]);
  });
});

describe('ventana y sincronización', () => {
  const w = syncWindow('2026-11-11'); // miércoles

  test('ventana: lunes de esta semana → domingo de la siguiente', () => {
    expect(w.from).toBe('2026-11-09');
    expect(w.to).toBe('2026-11-22');
    expect(w.timeMin).toBe('2026-11-08T23:00:00.000Z');
    expect(w.timeMax).toBe('2026-11-22T23:00:00.000Z');
  });

  test('eventRows: sin título → «(Sin título)»; fuera de la ventana no entra', () => {
    expect(eventRows('cal', ev('a', '2026-11-10T18:00:00+01:00', '2026-11-10T19:00:00+01:00', { summary: ' ' }), w)[0].title).toBe(
      '(Sin título)',
    );
    expect(eventRows('cal', ev('b', '2026-11-23T18:00:00+01:00', '2026-11-23T19:00:00+01:00'), w)).toEqual([]);
  });

  const row = (event_id: string, date: string, start_time: string, end_time: string): GoogleEventRow => ({
    calendar_id: 'cal',
    event_id,
    date,
    start_time,
    end_time,
    title: event_id,
    updated: '2026-11-01T00:00:00Z',
  });

  test('completo: lo que no viene sobra; lo igual no se reescribe', () => {
    const current = [row('a', '2026-11-10', '18:00', '19:00'), row('borrado', '2026-11-12', '10:00', '11:00')];
    const plan = planEventsSync('cal', current, [ev('a', '2026-11-10T18:00:00+01:00', '2026-11-10T19:00:00+01:00')], true, w);
    expect(plan.upsert).toEqual([]);
    expect(plan.remove).toEqual([{ event_id: 'borrado', date: '2026-11-12' }]);
  });

  test('incremental: movido de día, cancelado y sin tocar', () => {
    const current = [
      row('movido', '2026-11-10', '18:00', '19:00'),
      row('cancelado', '2026-11-11', '18:00', '19:00'),
      row('quieto', '2026-11-12', '18:00', '19:00'),
    ];
    const plan = planEventsSync(
      'cal',
      current,
      [
        ev('movido', '2026-11-13T18:00:00+01:00', '2026-11-13T19:00:00+01:00'),
        { id: 'cancelado', status: 'cancelled' },
      ],
      false,
      w,
    );
    expect(plan.upsert.map((r) => [r.event_id, r.date])).toEqual([['movido', '2026-11-13']]);
    expect(plan.remove).toEqual([
      { event_id: 'movido', date: '2026-11-10' },
      { event_id: 'cancelado', date: '2026-11-11' },
    ]);
  });

  test('las filas que quedaron fuera de la ventana (semana pasada) se quitan', () => {
    const plan = planEventsSync('cal', [row('viejo', '2026-11-05', '18:00', '19:00')], [], false, w);
    expect(plan.remove).toEqual([{ event_id: 'viejo', date: '2026-11-05' }]);
  });

  test('stableUuid: mismo texto → mismo uuid válido', () => {
    const u = stableUuid('gcal:cal:a');
    expect(u).toBe(stableUuid('gcal:cal:a'));
    expect(u).not.toBe(stableUuid('gcal:cal:b'));
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
