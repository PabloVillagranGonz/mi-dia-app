import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { progressLabel, type Progress } from '@/domain/progress';
import { colors, fonts, radius, spacing } from '@/theme';

/** Barra fina animada. */
export function ProgressBar({ ratio, height = 6 }: { ratio: number; height?: number }) {
  const anim = useRef(new Animated.Value(ratio)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: ratio, duration: 450, useNativeDriver: false }).start();
  }, [ratio, anim]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.fill, { width, borderRadius: height / 2 }]} />
    </View>
  );
}

/** Tarjeta de progreso del día: «30 %  ·  3 de 8 tareas hechas». */
export function ProgressCard({ progress }: { progress: Progress }) {
  return (
    <View style={styles.card}>
      <Text style={styles.percent}>{Math.round(progress.ratio * 100)}%</Text>
      <View style={styles.right}>
        <Text style={styles.label}>{progressLabel(progress)}</Text>
        <ProgressBar ratio={progress.ratio} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.cardRaised, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', backgroundColor: colors.accent },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  percent: { color: colors.accent, fontFamily: fonts.display, fontSize: 40, lineHeight: 44, minWidth: 72 },
  right: { flex: 1, gap: spacing.sm },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
});
