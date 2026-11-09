// Tarjeta AHORA (grande, con pulso suave) y tarjeta PRÓXIMA.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category, DayActivity } from '@/data';
import type { NowState } from '@/domain/timeline';
import { formatDuration } from '@/domain/time';
import { colors, fonts, radius, spacing } from '@/theme';
import { CategoryDot } from './CategoryChip';

function usePulse() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

export function NowCard({
  state,
  categoryOf,
  onPress,
}: {
  state: NowState<DayActivity>;
  categoryOf: (id: string | null) => Category | undefined;
  onPress?: (a: DayActivity) => void;
}) {
  const pulse = usePulse();
  const a = state.current;
  const color = a ? (categoryOf(a.category_id)?.color ?? colors.accent) : colors.free;
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });

  return (
    <Pressable onPress={() => a && onPress?.(a)} disabled={!a}>
      <View style={[styles.card, { borderColor: `${color}55` }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, { borderColor: color, opacity: glow }]} />
        <View style={styles.topRow}>
          <View style={[styles.liveDot, { backgroundColor: color }]} />
          <Text style={styles.kicker}>{a ? `AHORA · HASTA LAS ${a.end_time}` : 'AHORA · TIEMPO LIBRE'}</Text>
        </View>

        <Text style={[styles.title, !a && { color: colors.textMuted }]} numberOfLines={2}>
          {a ? a.title : 'Tiempo libre'}
        </Text>

        <View style={styles.bottomRow}>
          {a ? (
            <View style={styles.cat}>
              <CategoryDot color={color} />
              <Text style={styles.meta}>{categoryOf(a.category_id)?.name ?? 'Sin categoría'}</Text>
            </View>
          ) : (
            <Text style={styles.meta}>
              {state.next && state.minutesToNext != null
                ? `Siguiente: ${state.next.title} en ${formatDuration(state.minutesToNext)}`
                : 'Nada más por hoy'}
            </Text>
          )}
          <Text style={styles.remaining}>
            {a ? `quedan ${formatDuration(state.minutesLeft)}` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function NextCard({ state, onPress }: { state: NowState<DayActivity>; onPress?: (a: DayActivity) => void }) {
  const n = state.next;
  if (!n || !state.current) return null; // en un hueco, «Siguiente» ya va dentro de AHORA
  return (
    <Pressable onPress={() => onPress?.(n)} style={styles.next}>
      <Text style={styles.nextKicker}>
        PRÓXIMA · {n.start_time}
        {state.minutesToNext != null ? ` · EN ${formatDuration(state.minutesToNext).toUpperCase()}` : ''}
      </Text>
      <Text style={styles.nextTitle} numberOfLines={1}>
        {n.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  glow: { borderRadius: radius.lg, borderWidth: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  kicker: { color: colors.textMuted, fontFamily: fonts.displaySemi, fontSize: 14, letterSpacing: 1.5 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, flexShrink: 1 },
  remaining: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 15 },
  next: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  nextKicker: { color: colors.textMuted, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 1.5 },
  nextTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
});
