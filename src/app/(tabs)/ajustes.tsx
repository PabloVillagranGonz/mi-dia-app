// Ajustes (spec §5): recordatorio dominical, notificaciones, Google Calendar, categorías y cerrar sesión.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorText, Label, SwitchRow, TimeField } from '@/components/form';
import { auth, errorMessage, repo, usingMockData, type Weekday } from '@/data';
import { weekdayShort } from '@/domain/time';
import { useRepoQuery } from '@/hooks/useRepoQuery';
import { useSession } from '@/hooks/useSession';
import { GoogleCalendarSettings } from '@/components/GoogleCalendarSettings';
import { WebPushSettings } from '@/components/WebPushSettings';
import { notificationsSupported, scheduledCount, sendTest } from '@/notifications';
import { colors, fonts, radius, spacing } from '@/theme';

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export default function AjustesScreen() {
  const session = useSession();
  const q = useRepoQuery(() => repo.getSettings(), 'settings');
  const s = q.data;
  const [error, setError] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  async function test() {
    setTestMsg(null);
    const ok = await sendTest();
    if (!ok) {
      setTestMsg('Sin permiso. Actívalo en Ajustes del iPhone → Expo Go → Notificaciones.');
      return;
    }
    const n = await scheduledCount();
    setTestMsg(`Llegará en 5 segundos (bloquea el móvil para verla). Avisos programados: ${n}.`);
  }

  async function update(patch: Parameters<typeof repo.updateSettings>[0]) {
    setError(null);
    try {
      await repo.updateSettings(patch);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function logout() {
    Alert.alert('Cerrar sesión', 'Tendrás que volver a escribir tu email y contraseña.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => auth.signOut() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ajustes</Text>
        {usingMockData ? <Text style={styles.mock}>Usando datos de prueba (no hay .env.local).</Text> : null}
        <ErrorText>{error ?? q.error}</ErrorText>

        <Text style={styles.section}>NOTIFICACIONES</Text>
        <View style={styles.card}>
          <SwitchRow
            label="Notificaciones"
            hint="Aviso al empezar cada actividad (las que tengan Aviso) y recordatorio de planificación"
            value={s?.notifications_enabled ?? true}
            onChange={(v) => update({ notifications_enabled: v })}
          />
          {notificationsSupported ? (
            <Pressable onPress={test} style={styles.testBtn}>
              <Ionicons name="notifications-outline" size={18} color={colors.accent} />
              <Text style={styles.testText}>Enviar notificación de prueba</Text>
            </Pressable>
          ) : (
            <WebPushSettings />
          )}
          {testMsg ? <Text style={styles.hint}>{testMsg}</Text> : null}
        </View>

        <Text style={styles.section}>RECORDATORIO DE PLANIFICACIÓN</Text>
        <View style={[styles.card, { gap: spacing.md }]}>
          <View>
            <Label>Día</Label>
            <View style={styles.days}>
              {WEEKDAYS.map((w) => {
                const on = s?.planning_reminder_weekday === w;
                return (
                  <Pressable key={w} onPress={() => update({ planning_reminder_weekday: w })} style={[styles.day, on && styles.dayOn]}>
                    <Text style={[styles.dayText, on && { color: colors.text }]}>{weekdayShort(w)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {s ? (
            <TimeField label="Hora" value={s.planning_reminder_time} onChange={(t) => update({ planning_reminder_time: t })} />
          ) : null}
          <Text style={styles.hint}>«Planifica tu semana». Al tocarlo se abre el asistente.</Text>
        </View>

        <GoogleCalendarSettings />

        <Text style={styles.section}>RUTINA</Text>
        <Pressable style={[styles.card, styles.link]} onPress={() => router.push('/categorias')}>
          <Ionicons name="pricetags-outline" size={20} color={colors.textMuted} />
          <Text style={styles.linkText}>Categorías</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>

        <Text style={styles.section}>CUENTA</Text>
        <View style={styles.card}>
          <Text style={styles.email}>{session?.email ?? '—'}</Text>
          {!usingMockData ? (
            <Pressable onPress={logout} style={styles.logout}>
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  mock: { color: colors.accent, fontFamily: fonts.medium, fontSize: 13 },
  section: { color: colors.textMuted, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 2, marginTop: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { backgroundColor: colors.accent },
  dayText: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 16 },
  hint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12 },
  testBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.xs },
  testText: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 15 },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  email: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  logoutText: { color: colors.danger, fontFamily: fonts.semibold, fontSize: 15 },
});
