// Piezas de formulario reutilizables (hojas de edición, rutina, ajustes).

import DateTimePicker from '@react-native-community/datetimepicker';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';

import type { HHMM } from '@/data';
import { fromMinutes, toMinutes } from '@/domain/time';
import { colors, fonts, radius, spacing } from '@/theme';

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textFaint} {...props} style={[styles.input, props.style]} />;
}

/** Selector de hora 24 h (rueda nativa de iOS en versión compacta). */
export function TimeField({ label, value, onChange, disabled }: { label: string; value: HHMM; onChange: (v: HHMM) => void; disabled?: boolean }) {
  const mins = toMinutes(value) % (24 * 60); // 24:00 se muestra como 00:00
  const date = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  return (
    <View style={styles.timeField}>
      <Label>{label}</Label>
      <View style={styles.timeBox}>
        {disabled ? (
          <Text style={styles.timeText}>{value}</Text>
        ) : (
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
        )}
      </View>
    </View>
  );
}

/** Control segmentado: «Tarea / Fija», «Evento / Actividad»… */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} style={[styles.segment, active && styles.segmentActive]} onPress={() => onChange(o.value)}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} />
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primary, (pressed || disabled) && { opacity: 0.75 }]}
    >
      <Text style={styles.primaryText}>{title}</Text>
    </Pressable>
  );
}

export function TextButton({ title, onPress, color = colors.textMuted }: { title: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.textButtonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.cardRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  timeField: { flex: 1 },
  timeBox: {
    backgroundColor: colors.cardRaised,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: { color: colors.text, fontFamily: fonts.displaySemi, fontSize: 20 },
  segmented: { flexDirection: 'row', backgroundColor: colors.cardRaised, borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 14 },
  segmentTextActive: { color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  switchLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  switchHint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  textButton: { paddingVertical: spacing.md, alignItems: 'center' },
  textButtonText: { fontFamily: fonts.semibold, fontSize: 15 },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
});
