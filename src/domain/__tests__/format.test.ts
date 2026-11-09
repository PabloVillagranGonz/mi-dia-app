import { formatHours, formatSince } from '../format';

describe('formatSince', () => {
  const now = new Date('2026-11-09T20:00:00Z');
  test.each([
    [null, 'nunca'],
    ['2026-11-09T19:59:40Z', 'ahora'],
    ['2026-11-09T19:55:00Z', 'hace 5 min'],
    ['2026-11-09T17:00:00Z', 'hace 3 h'],
    ['2026-11-08T18:00:00Z', 'ayer'],
    ['2026-11-05T20:00:00Z', 'hace 4 días'],
    ['2026-09-12T10:00:00Z', '12 sep 2026'],
  ])('%s → %s', (iso, expected) => {
    expect(formatSince(iso, now)).toBe(expected);
  });
});

test('formatHours', () => {
  expect(formatHours(45)).toBe('45 min');
  expect(formatHours(120)).toBe('2 h');
  expect(formatHours(150)).toBe('2 h 30 min');
});
