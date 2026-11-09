// Vista de un día concreto (desde Semana o Planificar).
// Pasado: solo lectura. Hoy: como la vista Hoy. Futuro: editar horarios y notas, sin marcar hecho.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivitySheet, type SheetTarget } from '@/components/ActivitySheet';
import { TextButton } from '@/components/form';
import { ProgressCard } from '@/components/ProgressBar';
import { Timeline } from '@/components/Timeline';
import { errorMessage, repo, type DayActivity } from '@/data';
import { progressOf } from '@/domain/progress';
import { compareDates, formatLongDate } from '@/domain/time';
import { useCategories } from '@/hooks/useCategories';
import { useNow } from '@/hooks/useNow';
import { useRepoQuery } from '@/hooks/useRepoQuery';
import { OfflineBanner } from '@/components/OfflineBanner';
import { colors, fonts, radius, spacing } from '@/theme';

export default function DiaScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const now = useNow();
  const isToday = date === now.date;
  const isPast = compareDates(date, now.date) < 0;

  const { categories, categoryOf } = useCategories();
  const q = useRepoQuery(() => repo.getDay(date), `dia:${date}`);
  const acts = q.data ?? [];
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function restore() {
    Alert.alert(
      'Restaurar rutina de este día',
      'Vuelve a poner la rutina base en los huecos. Los eventos, las actividades manuales y lo que hayas editado se mantienen.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restaurar', onPress: () => act(() => repo.restoreDay(date)) },
      ],
    );
  }

  const status = isPast ? 'Solo lectura' : isToday ? 'Hoy' : 'Puedes ajustar horarios y añadir eventos';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
          <Text style={styles.backText}>Atrás</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.date}>{formatLongDate(date)}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <OfflineBanner />

        {q.loading && !q.data ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <ProgressCard progress={progressOf(acts)} />
            <Timeline
              activities={acts}
              categoryOf={categoryOf}
              nowMinutes={isToday ? now.minutes : null}
              canCheck={isToday}
              onPress={(a: DayActivity) => setTarget({ mode: 'edit', activity: a })}
              onToggle={isToday ? (a) => act(() => repo.toggleDone(a.id)) : undefined}
            />
            {!isPast ? <TextButton title="Restaurar rutina de este día" onPress={restore} /> : null}
          </>
        )}
      </ScrollView>

      {!isPast ? (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          onPress={() => setTarget({ mode: 'create', date, start: '18:00', end: '20:00' })}
        >
          <Ionicons name="add" size={30} color={colors.text} />
        </Pressable>
      ) : null}

      <ActivitySheet target={target} categories={categories} canCheck={isToday} readOnly={isPast} onClose={() => setTarget(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  status: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  date: { color: colors.text, fontFamily: fonts.display, fontSize: 34, lineHeight: 38 },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
