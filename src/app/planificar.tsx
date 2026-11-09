// Asistente de planificación (spec §5): 1) origen, 2) revisar días y añadir eventos, 3) confirmar.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorText, PrimaryButton } from '@/components/form';
import { WeekDayCard } from '@/components/WeekDayCard';
import { errorMessage, repo } from '@/data';
import { localNow } from '@/domain/clock';
import { addDays, compareDates, formatShortDate, weekDates, weekStartOf } from '@/domain/time';
import { useCategories } from '@/hooks/useCategories';
import { useRepoQuery } from '@/hooks/useRepoQuery';
import { colors, fonts, radius, spacing } from '@/theme';

type Mode = 'base' | 'copy';

export default function PlanificarScreen() {
  const params = useLocalSearchParams<{ week?: string }>();
  const today = localNow().date;
  const weekStart = params.week ?? addDays(weekStartOf(today), 7);
  const weekEnd = addDays(weekStart, 6);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<Mode>('base');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { categoryOf } = useCategories();
  const existing = useRepoQuery(() => repo.getWeek(weekStart), `plan-week:${weekStart}`);
  const acts = useRepoQuery(() => repo.getRange(weekStart, weekEnd), `plan-acts:${weekStart}`);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await repo.planWeek(weekStart, mode);
      setStep(2);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.kicker}>
          PLANIFICAR · {formatShortDate(weekStart)} – {formatShortDate(weekEnd)}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.steps}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.stepBar, n <= step && { backgroundColor: colors.accent }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 ? (
          <>
            <Text style={styles.title}>¿De dónde sale la semana?</Text>
            <Option
              icon="repeat"
              title="Rutina base"
              text="Cada día con su plantilla de L a D."
              selected={mode === 'base'}
              onPress={() => setMode('base')}
            />
            <Option
              icon="copy"
              title="Copiar la semana anterior"
              text="Copia las actividades añadidas a mano y los horarios que ajustaste. No copia eventos, hechos ni notas."
              selected={mode === 'copy'}
              onPress={() => setMode('copy')}
            />
            {existing.data ? (
              <Text style={styles.warning}>
                Esta semana ya está planificada. Volver a generarla sustituye sus actividades (los eventos que ya hayas puesto se
                mantienen).
              </Text>
            ) : null}
            <ErrorText>{error}</ErrorText>
            <PrimaryButton title={busy ? 'Generando…' : 'Continuar'} onPress={generate} disabled={busy} />
            {existing.data ? <PrimaryButtonGhost title="Mantener como está y revisar" onPress={() => setStep(2)} /> : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>Revisa cada día</Text>
            <Text style={styles.text}>Entra en un día y usa el «+» para añadir ensayos, bolos o citas. Recortan la rutina automáticamente.</Text>
            {acts.loading && !acts.data ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              weekDates(weekStart).map((date) => (
                <WeekDayCard
                  key={date}
                  date={date}
                  activities={(acts.data ?? []).filter((a) => a.date === date)}
                  categoryOf={categoryOf}
                  isToday={date === today}
                  isPast={compareDates(date, today) < 0}
                  onPress={() => router.push({ pathname: '/dia/[date]', params: { date } })}
                />
              ))
            )}
            <PrimaryButton title="Continuar" onPress={() => setStep(3)} />
          </>
        ) : null}

        {step === 3 ? (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={styles.title}>Semana lista</Text>
            <Text style={[styles.text, { textAlign: 'center' }]}>
              Puedes seguir ajustándola desde la pestaña Semana cuando quieras.
            </Text>
            <View style={{ alignSelf: 'stretch' }}>
              <PrimaryButton title="Terminar" onPress={() => router.back()} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Option({
  icon,
  title,
  text,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.option, selected && styles.optionSelected]}>
      <Ionicons name={icon} size={24} color={selected ? colors.accent : colors.textMuted} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionText}>{text}</Text>
      </View>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.accent : colors.textFaint} />
    </Pressable>
  );
}

function PrimaryButtonGhost({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.7 }]}>
      <Text style={styles.ghostText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  kicker: { color: colors.textMuted, fontFamily: fonts.displaySemi, fontSize: 14, letterSpacing: 1.5 },
  steps: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.cardRaised },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  text: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  warning: { color: colors.accent, fontFamily: fonts.medium, fontSize: 13 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  optionText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  ghost: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  ghostText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  done: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xxl, alignSelf: 'stretch' },
});
