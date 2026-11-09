// Selector de hora para la web: <input type="time"> (en iPhone abre la rueda de Safari).
import { createElement } from 'react';

import type { HHMM } from '@/data';
import { fromMinutes, toMinutes } from '@/domain/time';
import { colors, fonts } from '@/theme';

export function TimePicker({ value, onChange }: { value: HHMM; onChange: (v: HHMM) => void }) {
  const mins = toMinutes(value) % (24 * 60); // 24:00 se muestra como 00:00
  return createElement('input', {
    type: 'time',
    step: 300,
    value: fromMinutes(mins),
    onChange: (e: { target: { value: string } }) => {
      const v = e.target.value; // «HH:MM»; vacío si se borra
      if (/^\d{2}:\d{2}$/.test(v)) onChange(v as HHMM);
    },
    style: {
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: colors.text,
      colorScheme: 'dark',
      fontFamily: fonts.displaySemi,
      fontSize: 20,
      textAlign: 'center',
      width: '100%',
      minHeight: 48,
    },
  });
}
