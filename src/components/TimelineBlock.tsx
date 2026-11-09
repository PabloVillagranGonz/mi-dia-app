// Fila de la línea de tiempo: hora a la izquierda, punto + línea, tarjeta y check redondo (captura 01-hoy).

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category, DayActivity } from '@/data';
import { toMinutes, formatDuration } from '@/domain/time';
import type { Gap } from '@/domain/timeline';
import { colors, fonts, radius, spacing } from '@/theme';

interface ActivityProps {
  activity: DayActivity;
  category?: Category;
  isNow?: boolean;
  isPast?: boolean;
  canCheck?: boolean;
  onPress?: () => void;
  onToggle?: () => void;
}

function TimeColumn({ start, end, dim }: { start: string; end: string; dim?: boolean }) {
  return (
    <View style={styles.timeCol}>
      <Text style={[styles.start, dim && { color: colors.textMuted }]}>{start}</Text>
      <Text style={styles.end}>{end}</Text>
    </View>
  );
}

function Rail({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <View style={styles.rail}>
      <View style={[styles.dot, { backgroundColor: dashed ? 'transparent' : color, borderColor: color }]} />
      <View style={[styles.line, dashed ? { borderLeftColor: colors.free, borderStyle: 'dashed' } : { borderLeftColor: `${color}66` }]} />
    </View>
  );
}

function Check({ done, onPress, disabled }: { done: boolean; onPress?: () => void; disabled?: boolean }) {
  const [scale] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!done) return;
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [done, scale]);
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={12}>
      <Animated.View style={[styles.check, done && styles.checkDone, disabled && !done && { opacity: 0.35 }, { transform: [{ scale }] }]}>
        {done ? <Ionicons name="checkmark" size={18} color={colors.text} /> : null}
      </Animated.View>
    </Pressable>
  );
}

export function TimelineBlock({ activity: a, category, isNow, isPast, canCheck, onPress, onToggle }: ActivityProps) {
  const color = category?.color ?? colors.textMuted;
  const dim = a.done;
  return (
    <View style={styles.row}>
      <TimeColumn start={a.start_time} end={a.end_time} dim={isPast && !isNow} />
      <Rail color={color} />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          isNow && { borderColor: colors.accent, backgroundColor: colors.cardRaised },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: color }]} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, dim && styles.titleDone]} numberOfLines={2}>
              {a.title}
            </Text>
            {a.external_id ? <Ionicons name="logo-google" size={12} color={colors.textMuted} accessibilityLabel="Google Calendar" /> : null}
            {isNow ? <Text style={styles.nowTag}>AHORA</Text> : null}
          </View>
          <Text style={[styles.meta, dim && { color: colors.textFaint }]} numberOfLines={1}>
            {category?.name ?? 'Sin categoría'} · {a.start_time}–{a.end_time}
            {a.kind === 'fixed' ? ' · fija' : ''}
            {a.origin === 'event' && !a.external_id ? ' · evento' : ''}
          </Text>
          {a.note ? (
            <Text style={styles.note} numberOfLines={2}>
              {a.note}
            </Text>
          ) : null}
        </View>
        <Check done={a.done} onPress={onToggle} disabled={!canCheck} />
      </Pressable>
    </View>
  );
}

/** Hueco calculado: «Tiempo libre», gris y con trazo discontinuo. */
export function GapBlock({ gap, isNow }: { gap: Gap; isNow?: boolean }) {
  const minutes = toMinutes(gap.end_time) - toMinutes(gap.start_time);
  return (
    <View style={styles.row}>
      <TimeColumn start={gap.start_time} end={gap.end_time} dim />
      <Rail color={colors.free} dashed />
      <View style={[styles.gap, isNow && { borderColor: colors.textMuted }]}>
        <Text style={styles.gapTitle}>Tiempo libre</Text>
        <Text style={styles.gapMeta}>{formatDuration(minutes)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 72 },
  timeCol: { width: 52, paddingTop: spacing.md },
  start: { color: colors.text, fontFamily: fonts.display, fontSize: 18, lineHeight: 20 },
  end: { color: colors.textFaint, fontFamily: fonts.displaySemi, fontSize: 12 },
  rail: { width: 20, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: spacing.md + 4 },
  line: { flex: 1, borderLeftWidth: 2, marginTop: 4 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    overflow: 'hidden',
  },
  accentBar: { width: 3, alignSelf: 'stretch', marginRight: spacing.md, borderRadius: 2, opacity: 0.9 },
  body: { flex: 1, gap: 3, marginRight: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16, flexShrink: 1 },
  titleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  nowTag: { color: colors.accent, fontFamily: fonts.displaySemi, fontSize: 12, letterSpacing: 1.2 },
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  note: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  gap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.free,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  gapTitle: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 15 },
  gapMeta: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 13 },
});
