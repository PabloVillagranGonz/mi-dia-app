// Tarjeta de un día en la vista Semana: nombre, fecha, progreso y bloques en miniatura (franja de 24 h).

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category, DayActivity, ISODate } from '@/data';
import { progressOf } from '@/domain/progress';
import { DAY_MINUTES, formatShortDate, toMinutes, weekdayName, weekdayOf } from '@/domain/time';
import { colors, fonts, radius, spacing } from '@/theme';
import { ProgressBar } from './ProgressBar';

interface Props {
  date: ISODate;
  activities: DayActivity[];
  categoryOf: (id: string | null) => Category | undefined;
  isToday: boolean;
  isPast: boolean;
  onPress: () => void;
}

export function WeekDayCard({ date, activities, categoryOf, isToday, isPast, onPress }: Props) {
  const p = progressOf(activities);
  const events = activities.filter((a) => a.origin === 'event').length;
  const name = weekdayName(weekdayOf(date));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, isToday && styles.today, isPast && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.head}>
        <View style={styles.dayCol}>
          <Text style={[styles.day, isToday && { color: colors.accent }]}>{name[0].toUpperCase() + name.slice(1)}</Text>
          <Text style={styles.date}>{formatShortDate(date)}</Text>
        </View>
        <View style={styles.stats}>
          {p.total ? (
            <Text style={styles.count}>
              {p.done}/{p.total} tareas
            </Text>
          ) : (
            <Text style={styles.count}>{activities.length ? 'Sin tareas' : 'Libre'}</Text>
          )}
          {events ? (
            <Text style={styles.events}>
              {events} {events === 1 ? 'evento' : 'eventos'}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </View>

      <View style={styles.strip}>
        {activities.map((a) => {
          const s = toMinutes(a.start_time);
          const e = toMinutes(a.end_time);
          return (
            <View
              key={a.id}
              style={[
                styles.segment,
                {
                  left: `${(s / DAY_MINUTES) * 100}%`,
                  width: `${((e - s) / DAY_MINUTES) * 100}%`,
                  backgroundColor: categoryOf(a.category_id)?.color ?? colors.textMuted,
                  opacity: a.done ? 0.35 : 0.9,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.scale}>
        {['00', '06', '12', '18', '24'].map((h) => (
          <Text key={h} style={styles.scaleText}>
            {h}
          </Text>
        ))}
      </View>

      {p.total ? <ProgressBar ratio={p.ratio} height={4} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  today: { borderColor: colors.accent },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayCol: { flex: 1 },
  day: { color: colors.text, fontFamily: fonts.display, fontSize: 22, lineHeight: 24 },
  date: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  stats: { alignItems: 'flex-end' },
  count: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  events: { color: colors.accent, fontFamily: fonts.medium, fontSize: 12 },
  strip: {
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.cardRaised,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  segment: { position: 'absolute', top: 0, bottom: 0, borderRadius: 2 },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleText: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 10 },
});
