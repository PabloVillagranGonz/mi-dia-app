// Piezas comunes de las pantallas de administración.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/theme';

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[adminStyles.badge, { borderColor: color }]}>
      <Text style={[adminStyles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

/** Título de una sección de la consola. `back`: enlace «‹ Volver» (p. ej. de la ficha a la lista). */
export function AdminHeader({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  return (
    <View style={adminStyles.topBar}>
      {back ? (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(back as never))} hitSlop={12} style={adminStyles.back}>
          <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
          <Text style={adminStyles.backText}>Volver</Text>
        </Pressable>
      ) : null}
      <Text style={adminStyles.title}>{title}</Text>
      {subtitle ? <Text style={adminStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Cifra grande con su etiqueta (tarjetas del resumen). */
export function Stat({ value, label, tone }: { value: string | number; label: string; tone?: string }) {
  return (
    <View style={adminStyles.stat}>
      <Text style={[adminStyles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={adminStyles.statLabel}>{label}</Text>
    </View>
  );
}

export const adminStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { gap: spacing.xs, marginBottom: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: spacing.xs },
  backText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 2,
  },
  statValue: { color: colors.text, fontFamily: fonts.display, fontSize: 34, lineHeight: 38 },
  statLabel: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  rowMain: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  rowSide: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm, width: '100%', maxWidth: 880, alignSelf: 'center' },
  section: { color: colors.textMuted, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addText: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 15 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  email: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  hint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12 },
  ok: { color: colors.success, fontFamily: fonts.medium, fontSize: 13 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11 },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingVertical: spacing.xs },
  actionText: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 15 },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
