// Selector de hora nativo (rueda compacta de iOS). En la web: TimePicker.web.tsx.
import DateTimePicker from '@react-native-community/datetimepicker';

import type { HHMM } from '@/data';
import { fromMinutes, toMinutes } from '@/domain/time';
import { colors } from '@/theme';

export function TimePicker({ value, onChange }: { value: HHMM; onChange: (v: HHMM) => void }) {
  const mins = toMinutes(value) % (24 * 60); // 24:00 se muestra como 00:00
  const date = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  return (
    <DateTimePicker
      value={date}
      mode="time"
      display="compact"
      locale="es-ES"
      minuteInterval={5}
      themeVariant="dark"
      accentColor={colors.accent}
      onValueChange={(_e, d) => onChange(fromMinutes(d.getHours() * 60 + d.getMinutes()))}
    />
  );
}
