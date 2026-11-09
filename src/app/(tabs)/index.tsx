import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivitySheet, type SheetTarget } from '@/components/ActivitySheet';
import { NextCard, NowCard } from '@/components/NowCard';
import { ProgressCard } from '@/components/ProgressBar';
import { Timeline } from '@/components/Timeline';
import { errorMessage, repo, type Category, type DayActivity } from '@/data';
import { greeting } from '@/domain/clock';
import { progressOf } from '@/domain/progress';
import { addDays, formatLongDate, fromMinutes, weekStartOf, weekdayOf } from '@/domain/time';
import { nowState } from '@/domain/timeline';
import { useNow } from '@/hooks/useNow';
import { useRepoQuery } from '@/hooks/useRepoQuery';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, fonts, radius, spacing } from '@/theme';

export default function HoyScreen() {
  const now = useNow();
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const nowMinutes = now.minutes + now.seconds / 60;

  const acts = useRepoQuery(() => repo.getRange(today, tomorrow), `hoy:${today}`);
  const cats = useRepoQuery(() => repo.getCategories(), 'categories');
  const isSunday = weekdayOf(today) === 7;
  const nextWeekStart = addDays(weekStartOf(today), 7);
  const nextWeek = useRepoQuery(() => (isSunday ? repo.getWeek(nextWeekStart) : Promise.resolve(null)), `next:${nextWeekStart}:${isSunday}`);

  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const timelineY = useRef(0);
  const scrolled = useRef(false);

  const catMap = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c])), [cats.data]);
  const categoryOf = (id: string | null): Category | undefined => (id ? catMap.get(id) : undefined);

  const todays = useMemo(() => (acts.data ?? []).filter((a) => a.date === today), [acts.data, today]);
  const tomorrowFirst = useMemo(
    () => (acts.data ?? []).filter((a) => a.date === tomorrow).sort((a, b) => a.start_time.localeCompare(b.start_time))[0] ?? null,
    [acts.data, tomorrow],
  );
  const state = nowState(todays, nowMinutes, tomorrowFirst);
  const progress = progressOf(todays);

  async function toggle(a: DayActivity) {
    setToggleError(null);
    try {
      await repo.toggleDone(a.id);
    } catch (e) {
      setToggleError(errorMessage(e));
    }
  }

  function openCreate() {
    const s = Math.min(Math.ceil(now.minutes / 5) * 5, 23 * 60 + 55);
    setTarget({ mode: 'create', date: today, start: fromMinutes(s), end: fromMinutes((s + 60) % (24 * 60)) });
  }

  if (acts.loading && !acts.data) {
    return (
      <View style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => (acts.refresh(), cats.refresh())} tintColor={colors.accent} />}
      >
        <View>
          <Text style={styles.greeting}>{greeting(now.minutes)}</Text>
          <Text style={styles.date}>{formatLongDate(today)}</Text>
        </View>

        {acts.error ? <Text style={styles.error}>{acts.error}</Text> : null}
        <OfflineBanner />

        {isSunday && nextWeek.data === null && !nextWeek.loading ? (
          <Pressable style={styles.banner} onPress={() => router.push('/planificar')}>
            <Ionicons name="calendar" size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Planifica tu semana</Text>
              <Text style={styles.bannerText}>La semana que viene aún no está planificada.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}

        <ProgressCard progress={progress} />
        <NowCard state={state} categoryOf={categoryOf} onPress={(a) => setTarget({ mode: 'edit', activity: a })} />
        <NextCard state={state} onPress={(a) => setTarget({ mode: 'edit', activity: a })} />

        <Text style={styles.section}>TU DÍA</Text>
        {toggleError ? <Text style={styles.error}>{toggleError}</Text> : null}

        <View onLayout={(e) => (timelineY.current = e.nativeEvent.layout.y)}>
          <Timeline
            activities={todays}
            categoryOf={categoryOf}
            nowMinutes={nowMinutes}
            canCheck
            onPress={(a) => setTarget({ mode: 'edit', activity: a })}
            onToggle={toggle}
            onNowLayout={(y) => {
              if (scrolled.current) return;
              scrolled.current = true;
              // Dejar el bloque actual cerca de la parte de arriba
              setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, timelineY.current + y - 140), animated: true }), 300);
            }}
          />
        </View>
      </ScrollView>

      <Pressable style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]} onPress={openCreate}>
        <Ionicons name="add" size={30} color={colors.text} />
      </Pressable>

      <ActivitySheet target={target} categories={cats.data ?? []} canCheck onClose={() => setTarget(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  greeting: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },
  date: { color: colors.text, fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  section: { color: colors.textMuted, fontFamily: fonts.displaySemi, fontSize: 14, letterSpacing: 2, marginTop: spacing.md },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  bannerTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  bannerText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
