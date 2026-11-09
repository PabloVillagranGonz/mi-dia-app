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

export function AdminHeader({ title }: { title: string }) {
  return (
    <View style={adminStyles.topBar}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={adminStyles.back}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
        <Text style={adminStyles.backText}>Atrás</Text>
      </Pressable>
      <Text style={adminStyles.title}>{title}</Text>
    </View>
  );
}

export const adminStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  backText: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
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
