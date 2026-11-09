// Rutina base (captura 03): pestañas L M X J V S D, lista del día, crear/editar/borrar y «Copiar este día a…».

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryDot } from '@/components/CategoryChip';
import { PrimaryButton } from '@/components/form';
import { CopyDaySheet, TemplateSheet, type TemplateTarget } from '@/components/TemplateSheet';
import { repo, type Weekday } from '@/data';
import { localNow } from '@/domain/clock';
import { buildTimeline } from '@/domain/timeline';
import { formatDuration, toMinutes, weekdayName, weekdayOf, weekdayShort } from '@/domain/time';
import { useCategories } from '@/hooks/useCategories';
import { useRepoQuery } from '@/hooks/useRepoQuery';
import { colors, fonts, radius, spacing } from '@/theme';

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export default function RutinaScreen() {
  const [weekday, setWeekday] = useState<Weekday>(() => weekdayOf(localNow().date));
  const [target, setTarget] = useState<TemplateTarget | null>(null);
  const [copyFrom, setCopyFrom] = useState<Weekday | null>(null);

  const { categories, categoryOf } = useCategories();
  const q = useRepoQuery(() => repo.getTemplates(), 'templates');
  const all = q.data ?? [];
  const ofDay = all.filter((t) => t.weekday === weekday);
  const items = buildTimeline(ofDay);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Rutina base</Text>
            <Text style={styles.subtitle}>Tu plantilla de cada día. Alimenta la planificación dominical.</Text>
          </View>
          <Pressable onPress={() => router.push('/categorias')} style={styles.catBtn} hitSlop={8}>
            <Ionicons name="pricetags-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {WEEKDAYS.map((w) => {
            const active = w === weekday;
            const count = all.filter((t) => t.weekday === w).length;
            return (
              <Pressable key={w} onPress={() => setWeekday(w)} style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{weekdayShort(w)}</Text>
                <View style={[styles.tabDot, { opacity: count ? 1 : 0 }, active && { backgroundColor: colors.text }]} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dayHeader}>
          <Text style={styles.dayName}>{weekdayName(weekday)[0].toUpperCase() + weekdayName(weekday).slice(1)}</Text>
          <Pressable onPress={() => setCopyFrom(weekday)} style={styles.copyBtn} disabled={!ofDay.length}>
            <Ionicons name="copy-outline" size={16} color={ofDay.length ? colors.accent : colors.textFaint} />
            <Text style={[styles.copyText, !ofDay.length && { color: colors.textFaint }]}>Copiar este día a…</Text>
          </Pressable>
        </View>

        {q.error ? <Text style={styles.error}>{q.error}</Text> : null}

        {ofDay.length === 0 && !q.loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Día libre: sin actividades en la rutina.</Text>
          </View>
        ) : (
          items.map((item) => {
            if (item.kind === 'gap') {
              const mins = toMinutes(item.end_time) - toMinutes(item.start_time);
              return (
                <View key={`gap-${item.start_time}`} style={styles.gap}>
                  <Text style={styles.gapText}>
                    {item.start_time}–{item.end_time} · Tiempo libre · {formatDuration(mins)}
                  </Text>
                </View>
              );
            }
            const t = item.activity;
            const cat = categoryOf(t.category_id);
            return (
              <Pressable
                key={t.id}
                onPress={() => setTarget({ mode: 'edit', template: t })}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.times}>
                  <Text style={styles.start}>{t.start_time}</Text>
                  <Text style={styles.end}>{t.end_time}</Text>
                </View>
                <View style={[styles.bar, { backgroundColor: cat?.color ?? colors.textMuted }]} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <CategoryDot color={cat?.color ?? colors.textMuted} />
                    <Text style={styles.meta}>{cat?.name ?? 'Sin categoría'}</Text>
                    <Text style={styles.meta}>· {t.kind === 'task' ? 'Tarea' : 'Fija'}</Text>
                    {t.split_group_id ? <Ionicons name="moon-outline" size={12} color={colors.textMuted} /> : null}
                  </View>
                </View>
                <Ionicons
                  name={t.notify ? 'notifications-outline' : 'notifications-off-outline'}
                  size={18}
                  color={t.notify ? colors.textMuted : colors.textFaint}
                />
                <Ionicons name="pencil" size={16} color={colors.textMuted} style={{ marginLeft: spacing.sm }} />
              </Pressable>
            );
          })
        )}

        <View style={{ marginTop: spacing.sm }}>
          <PrimaryButton title="+  Añadir actividad" onPress={() => setTarget({ mode: 'create', weekday })} />
        </View>
      </ScrollView>

      <TemplateSheet target={target} categories={categories} onClose={() => setTarget(null)} />
      <CopyDaySheet from={copyFrom} onClose={() => setCopyFrom(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  catBtn: { backgroundColor: colors.card, borderRadius: radius.pill, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill, gap: 2 },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 18 },
  tabTextActive: { color: colors.text },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  dayName: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  copyText: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 14 },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  empty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.free,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  times: { width: 48, alignItems: 'center' },
  start: { color: colors.text, fontFamily: fonts.display, fontSize: 18, lineHeight: 20 },
  end: { color: colors.textFaint, fontFamily: fonts.displaySemi, fontSize: 13 },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  cardTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  gap: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.free,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  gapText: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 13 },
});
