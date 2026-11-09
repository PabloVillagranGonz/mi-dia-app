import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form';
import { ProgressCard } from '@/components/ProgressBar';
import { WeekDayCard } from '@/components/WeekDayCard';
import { repo } from '@/data';
import { progressOf } from '@/domain/progress';
import { addDays, compareDates, formatShortDate, weekDates, weekStartOf } from '@/domain/time';
import { useCategories } from '@/hooks/useCategories';
import { useNow } from '@/hooks/useNow';
import { useRepoQuery } from '@/hooks/useRepoQuery';
import { colors, fonts, radius, spacing } from '@/theme';

export default function SemanaScreen() {
  const { date: today } = useNow();
  const currentWeek = weekStartOf(today);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const weekEnd = addDays(weekStart, 6);

  const { categoryOf } = useCategories();
  const q = useRepoQuery(
    async () => {
      const [week, acts] = await Promise.all([repo.getWeek(weekStart), repo.getRange(weekStart, weekEnd)]);
      return { week, acts };
    },
    `semana:${weekStart}`,
  );

  const isPastWeek = compareDates(weekEnd, today) < 0;
  const isCurrent = weekStart === currentWeek;
  const nextWeek = addDays(currentWeek, 7);
  const acts = q.data?.acts ?? [];
  const planned = !!q.data?.week;

  const label = isCurrent ? 'Esta semana' : weekStart === nextWeek ? 'Semana que viene' : isPastWeek ? 'Semana pasada' : 'Semana';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Semana</Text>

        <View style={styles.nav}>
          <Pressable hitSlop={12} onPress={() => setWeekStart(addDays(weekStart, -7))} style={styles.arrow}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Pressable style={styles.navCenter} onPress={() => setWeekStart(currentWeek)}>
            <Text style={styles.navLabel}>{label.toUpperCase()}</Text>
            <Text style={styles.navRange}>
              {formatShortDate(weekStart)} – {formatShortDate(weekEnd)}
            </Text>
          </Pressable>
          <Pressable hitSlop={12} onPress={() => setWeekStart(addDays(weekStart, 7))} style={styles.arrow}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
        </View>

        {isPastWeek ? <Text style={styles.readonly}>Solo lectura</Text> : null}

        {q.loading && !q.data ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : q.error ? (
          <Text style={styles.error}>{q.error}</Text>
        ) : !planned ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Semana sin planificar</Text>
            <Text style={styles.emptyText}>
              {isPastWeek ? 'No hay registro de esta semana.' : 'Genérala desde tu rutina base o copiando la anterior.'}
            </Text>
            {!isPastWeek ? (
              <PrimaryButton title="Planificar esta semana" onPress={() => router.push({ pathname: '/planificar', params: { week: weekStart } })} />
            ) : null}
          </View>
        ) : (
          <>
            <ProgressCard progress={progressOf(acts)} />
            {weekDates(weekStart).map((date) => (
              <WeekDayCard
                key={date}
                date={date}
                activities={acts.filter((a) => a.date === date)}
                categoryOf={categoryOf}
                isToday={date === today}
                isPast={compareDates(date, today) < 0}
                onPress={() => router.push({ pathname: '/dia/[date]', params: { date } })}
              />
            ))}
          </>
        )}

        {isCurrent ? (
          <View style={{ marginTop: spacing.md }}>
            <PrimaryButton title="Planificar semana siguiente" onPress={() => router.push({ pathname: '/planificar', params: { week: nextWeek } })} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  arrow: { padding: spacing.sm },
  navCenter: { flex: 1, alignItems: 'center' },
  navLabel: { color: colors.textMuted, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 1.5 },
  navRange: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
  readonly: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  empty: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
});
