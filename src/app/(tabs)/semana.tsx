import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, TextButton } from '@/components/form';
import { ProgressCard } from '@/components/ProgressBar';
import { WeekDayCard } from '@/components/WeekDayCard';
import { errorMessage, repo, type DayActivity, type ISODate, type Week } from '@/data';
import { progressOf } from '@/domain/progress';
import { addDays, compareDates, formatShortDate, weekDates, weekStartOf } from '@/domain/time';
import { useCategories } from '@/hooks/useCategories';
import { useNow } from '@/hooks/useNow';
import { colors, fonts, radius, spacing } from '@/theme';

interface WeekData {
  week: Week | null;
  acts: DayActivity[];
}

async function loadWeek(weekStart: ISODate): Promise<WeekData> {
  const [week, acts] = await Promise.all([repo.getWeek(weekStart), repo.getRange(weekStart, addDays(weekStart, 6))]);
  return { week, acts };
}

/** Semanas en memoria: cambiar de semana es instantáneo y las vecinas se precargan. */
function useWeekCache(weekStart: ISODate) {
  const cache = useRef(new Map<ISODate, WeekData>());
  const [, force] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchWeek = useCallback(async (ws: ISODate, notify: boolean) => {
    try {
      const data = await loadWeek(ws);
      cache.current.set(ws, data);
      if (notify) {
        setError(null);
        force((n) => n + 1);
      }
    } catch (e) {
      if (notify) setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    fetchWeek(weekStart, true);
    // Precargar la anterior y la siguiente
    fetchWeek(addDays(weekStart, -7), false);
    fetchWeek(addDays(weekStart, 7), false);
  }, [weekStart, fetchWeek]);

  useEffect(() => {
    const refreshAll = () => {
      cache.current.clear();
      fetchWeek(weekStart, true);
    };
    const off = repo.subscribe(refreshAll);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && fetchWeek(weekStart, true));
    return () => {
      off();
      sub.remove();
    };
  }, [weekStart, fetchWeek]);

  return { data: cache.current.get(weekStart), error };
}

/** Entrada escalonada de cada tarjeta. */
function Stagger({ index, animKey, children }: { index: number; animKey: string; children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 320,
      delay: index * 35,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animKey, index, v]);
  return (
    <Animated.View
      style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}
    >
      {children}
    </Animated.View>
  );
}

export default function SemanaScreen() {
  const { date: today } = useNow();
  const currentWeek = weekStartOf(today);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const weekEnd = addDays(weekStart, 6);
  const { categoryOf } = useCategories();
  const { data, error } = useWeekCache(weekStart);

  // Animación de cambio de semana: la lista sale hacia un lado y entra por el otro
  const slide = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const go = useCallback(
    (dir: -1 | 1 | 0, target?: ISODate) => {
      const next = target ?? addDays(weekStart, dir * 7);
      if (next === weekStart) return;
      const d = dir || (compareDates(next, weekStart) > 0 ? 1 : -1);
      Animated.parallel([
        Animated.timing(slide, { toValue: -d * 40, duration: 120, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start(() => {
        setWeekStart(next);
        slide.setValue(d * 40);
        Animated.parallel([
          Animated.spring(slide, { toValue: 0, damping: 18, stiffness: 180, useNativeDriver: true }),
          Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
      });
    },
    [weekStart, slide, fade],
  );

  // Deslizar con el dedo a izquierda/derecha
  const goRef = useRef(go);
  goRef.current = go;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -60) goRef.current(1);
        else if (g.dx > 60) goRef.current(-1);
      },
    }),
  ).current;

  const isPastWeek = compareDates(weekEnd, today) < 0;
  const isCurrent = weekStart === currentWeek;
  const isFuture = compareDates(weekStart, currentWeek) > 0;
  const nextWeek = addDays(currentWeek, 7);
  const acts = data?.acts ?? [];
  const planned = !!data?.week;
  const label = isCurrent ? 'Esta semana' : weekStart === nextWeek ? 'Semana que viene' : isPastWeek ? 'Semana pasada' : 'Semana';

  function confirmDelete() {
    Alert.alert(
      'Borrar planificación',
      `Se borrarán todas las actividades y eventos de la semana del ${formatShortDate(weekStart)}. Quedará sin planificar y podrás volver a planificarla.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => repo.deleteWeek(weekStart).catch((e) => Alert.alert('No se pudo borrar', errorMessage(e))),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} {...pan.panHandlers}>
        <Text style={styles.title}>Semana</Text>

        <View style={styles.nav}>
          <Pressable hitSlop={12} onPress={() => go(-1)} style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Pressable style={styles.navCenter} onPress={() => go(0, currentWeek)}>
            <Animated.Text style={[styles.navLabel, { opacity: fade }]}>{label.toUpperCase()}</Animated.Text>
            <Animated.Text style={[styles.navRange, { opacity: fade }]}>
              {formatShortDate(weekStart)} – {formatShortDate(weekEnd)}
            </Animated.Text>
          </Pressable>
          <Pressable hitSlop={12} onPress={() => go(1)} style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
        </View>

        <Animated.View style={{ gap: spacing.md, opacity: fade, transform: [{ translateX: slide }] }}>
          {isPastWeek ? <Text style={styles.readonly}>Solo lectura</Text> : null}

          {!data && !error ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
          ) : error && !data ? (
            <Text style={styles.error}>{error}</Text>
          ) : !planned ? (
            <Stagger index={0} animKey={weekStart}>
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Semana sin planificar</Text>
                <Text style={styles.emptyText}>
                  {isPastWeek ? 'No hay registro de esta semana.' : 'Genérala desde tu rutina base o copiando la anterior.'}
                </Text>
                {!isPastWeek ? (
                  <View style={{ alignSelf: 'stretch' }}>
                    <PrimaryButton
                      title="Planificar esta semana"
                      onPress={() => router.push({ pathname: '/planificar', params: { week: weekStart } })}
                    />
                  </View>
                ) : null}
              </View>
            </Stagger>
          ) : (
            <>
              <Stagger index={0} animKey={weekStart}>
                <ProgressCard progress={progressOf(acts)} />
              </Stagger>
              {weekDates(weekStart).map((date, i) => (
                <Stagger key={date} index={i + 1} animKey={weekStart}>
                  <WeekDayCard
                    date={date}
                    activities={acts.filter((a) => a.date === date)}
                    categoryOf={categoryOf}
                    isToday={date === today}
                    isPast={compareDates(date, today) < 0}
                    onPress={() => router.push({ pathname: '/dia/[date]', params: { date } })}
                  />
                </Stagger>
              ))}
              {isFuture ? (
                <View style={styles.futureActions}>
                  <TextButton
                    title="Volver a planificar"
                    color={colors.accent}
                    onPress={() => router.push({ pathname: '/planificar', params: { week: weekStart } })}
                  />
                  <TextButton title="Borrar planificación" color={colors.danger} onPress={confirmDelete} />
                </View>
              ) : null}
            </>
          )}
        </Animated.View>

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
  arrow: { padding: spacing.sm, borderRadius: radius.pill },
  arrowPressed: { backgroundColor: colors.cardRaised },
  navCenter: { flex: 1, alignItems: 'center' },
  navLabel: { color: colors.textMuted, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 1.5 },
  navRange: { color: colors.text, fontFamily: fonts.display, fontSize: 20 },
  readonly: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  empty: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.free,
    borderStyle: 'dashed',
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  emptyTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
  futureActions: { flexDirection: 'row', justifyContent: 'space-around' },
});
