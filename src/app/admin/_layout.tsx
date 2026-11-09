// Consola de administración: sidebar fijo en pantallas anchas y cajón (☰) en el móvil.
// Solo llega aquí la cuenta de administración (lo decide el layout raíz con user_flags.is_admin;
// el servidor vuelve a comprobarlo en cada llamada).

import { Ionicons } from '@expo/vector-icons';
import { router, Slot, usePathname } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth } from '@/data';
import { useSession } from '@/hooks/useSession';
import { Alert } from '@/lib/alert';
import { colors, fonts, radius, spacing } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const SECTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin', label: 'Resumen', icon: 'grid-outline' },
  { href: '/admin/usuarios', label: 'Usuarios', icon: 'people-outline' },
  { href: '/admin/demo', label: 'Demo', icon: 'sparkles-outline' },
  { href: '/admin/google', label: 'Google Calendar', icon: 'logo-google' },
  { href: '/admin/sistema', label: 'Sistema', icon: 'pulse-outline' },
];

/** Ancho a partir del cual el menú se queda fijo a la izquierda. */
const WIDE = 820;

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const session = useSession();

  function logout() {
    Alert.alert('Cerrar sesión', '¿Salir de la consola de administración?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => auth.signOut() },
    ]);
  }

  return (
    <View style={styles.nav}>
      <View style={styles.brand}>
        <Text style={styles.brandName}>Mi Día</Text>
        <Text style={styles.brandTag}>ADMIN</Text>
      </View>

      <View style={{ gap: 2 }}>
        {SECTIONS.map((s) => {
          const active = isActive(pathname, s.href);
          return (
            <Pressable
              key={s.href}
              onPress={() => {
                router.replace(s.href as never);
                onNavigate?.();
              }}
              style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && { opacity: 0.8 }]}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={s.icon} size={18} color={active ? colors.accent : colors.textMuted} />
              <Text style={[styles.itemText, active && { color: colors.text }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerEmail} numberOfLines={1}>
          {session?.email}
        </Text>
        <Pressable onPress={logout} style={styles.item} hitSlop={6}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={[styles.itemText, { color: colors.danger }]}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = SECTIONS.find((s) => isActive(pathname, s.href))?.label ?? 'Administración';

  if (wide) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.wideRow}>
          <View style={styles.sidebar}>
            <Nav />
          </View>
          <View style={styles.main}>
            <Slot />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setOpen(true)} hitSlop={12} accessibilityLabel="Abrir menú">
          <Ionicons name="menu" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>{current}</Text>
        <Text style={styles.brandTag}>ADMIN</Text>
      </View>
      <View style={styles.main}>
        <Slot />
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.drawerWrap}>
          <SafeAreaView style={styles.drawer} edges={['top', 'bottom']}>
            <Nav onNavigate={() => setOpen(false)} />
          </SafeAreaView>
          <Pressable style={styles.drawerBackdrop} onPress={() => setOpen(false)} accessibilityLabel="Cerrar menú" />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wideRow: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 240, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.card },
  main: { flex: 1 },
  nav: { flex: 1, padding: spacing.lg, gap: spacing.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  brandName: { color: colors.text, fontFamily: fonts.display, fontSize: 26 },
  brandTag: {
    color: colors.accent,
    fontFamily: fonts.displaySemi,
    fontSize: 12,
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  itemActive: { backgroundColor: colors.accentSoft },
  itemText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 15 },
  footer: { marginTop: 'auto', gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  footerEmail: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12, paddingHorizontal: spacing.sm },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { flex: 1, color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  drawerWrap: { flex: 1, flexDirection: 'row' },
  drawer: { width: 280, maxWidth: '85%', backgroundColor: colors.card, borderRightWidth: 1, borderRightColor: colors.border },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
});
