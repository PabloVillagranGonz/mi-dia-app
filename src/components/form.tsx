// Piezas de formulario reutilizables (hojas de edición, rutina, ajustes).

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';

import type { HHMM } from '@/data';
import { colors, fonts, radius, spacing } from '@/theme';

import { TimePicker } from './TimePicker';

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textFaint} {...props} style={[styles.input, props.style]} />;
}

/** Selector de hora 24 h (rueda nativa en iOS, <input type="time"> en la web). */
export function TimeField({ label, value, onChange, disabled }: { label: string; value: HHMM; onChange: (v: HHMM) => void; disabled?: boolean }) {
  return (
    <View style={styles.timeField}>
      <Label>{label}</Label>
      <View style={styles.timeBox}>
        {disabled ? (
          <Text style={styles.timeText}>{value}</Text>
        ) : (
          <TimePicker value={value} onChange={onChange} />
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
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#FFFFFF"
        // Solo react-native-web: sin esto el círculo activo sale verde azulado.
        {...({ activeThumbColor: '#FFFFFF' } as object)}
      />
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

/** Botón de acción peligrosa: contorno rojo a todo el ancho. */
export function DangerButton({ title, icon, onPress }: { title: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.danger, pressed && { backgroundColor: 'rgba(229,83,75,0.12)' }]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.danger} /> : null}
      <Text style={styles.dangerText}>{title}</Text>
    </Pressable>
  );
}

/** Botón secundario: contorno gris a todo el ancho. */
export function SecondaryButton({ title, icon, onPress }: { title: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondary, pressed && { backgroundColor: colors.cardRaised }]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.text} /> : null}
      <Text style={styles.secondaryText}>{title}</Text>
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
  danger: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 15,
  },
  dangerText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 16 },
  secondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 15,
  },
  secondaryText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
  textButton: { paddingVertical: spacing.md, alignItems: 'center' },
  textButtonText: { fontFamily: fonts.semibold, fontSize: 15 },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
});
