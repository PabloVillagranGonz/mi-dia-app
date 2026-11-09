// Consola → Usuarios → ficha: estadísticas y acciones sobre una cuenta.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminHeader, adminStyles, Badge } from '@/components/AdminUI';
import { ErrorText, Input, Label, PrimaryButton, SwitchRow } from '@/components/form';
import { ProgressBar } from '@/components/ProgressBar';
import { Sheet } from '@/components/Sheet';
import { adminApi, errorMessage, type AdminUser } from '@/data';
import type { AdminStats } from '@/data/admin';
import { formatHours, formatSince } from '@/domain/format';
import { formatShortDate } from '@/domain/time';
import { Alert } from '@/lib/alert';
import { colors, fonts, spacing } from '@/theme';

export default function AdminUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([adminApi.listUsers(), adminApi.userStats(id)]).then(
        ([users, s]) => {
          setUser(users.find((u) => u.id === id) ?? null);
          setStats(s);
          setError(null);
        },
        (e) => setError(errorMessage(e)),
      ),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const isMe = user?.is_admin ?? false;

  function toggleDisabled() {
    if (!user) return;
    const disabling = !user.disabled;
    Alert.alert(
      disabling ? 'Desactivar usuario' : 'Reactivar usuario',
      disabling
        ? `${user.email} no podrá entrar y se cerrarán sus sesiones. Sus datos se conservan.`
        : `${user.email} podrá volver a entrar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: disabling ? 'Desactivar' : 'Reactivar',
          style: disabling ? 'destructive' : 'default',
          onPress: () => run(() => adminApi.setDisabled(user.id, disabling), disabling ? 'Usuario desactivado.' : 'Usuario reactivado.'),
        },
      ],
    );
  }

  function remove() {
    if (!user) return;
    Alert.alert(
      'Borrar usuario',
      `Se borrarán ${user.email} y TODOS sus datos (rutina, semanas, notas, avisos, Google). No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await adminApi.deleteUser(user.id);
              router.replace('/admin/usuarios');
            } catch (e) {
              setError(errorMessage(e));
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  function toggleGoogle(allowed: boolean) {
    if (!user) return;
    if (!allowed && user.google_email) {
      Alert.alert('Quitar Google Calendar', 'Se desconectará su cuenta de Google y su rutina volverá de hoy en adelante.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: () => run(() => adminApi.setGoogle(user.id, false), 'Google Calendar quitado.') },
      ]);
      return;
    }
    run(() => adminApi.setGoogle(user.id, allowed), allowed ? 'Ya puede conectar Google en Ajustes.' : 'Google Calendar quitado.');
  }

  const s = stats?.stats;
  const catOf = (cid: string | null) => stats?.categories.find((c) => c.id === cid);
  const totalMinutes = s?.categories.reduce((n, c) => n + c.minutes, 0) ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={adminStyles.content}>
        <AdminHeader title={user?.email ?? 'Usuario'} back="/admin/usuarios" />
        <ErrorText>{error}</ErrorText>
        {msg ? <Text style={adminStyles.ok}>{msg}</Text> : null}
        {!user && !error ? <ActivityIndicator color={colors.accent} /> : null}

        {user ? (
          <View style={adminStyles.card}>
            <Text style={adminStyles.hint}>
              Alta: {formatShortDate(user.created_at.slice(0, 10))} · Último acceso: {formatSince(user.last_sign_in_at)}
            </Text>
            <Text style={adminStyles.hint}>
              {user.devices === 1 ? '1 dispositivo' : `${user.devices} dispositivos`} con avisos
              {user.google_email ? ` · Google: ${user.google_email}` : ''}
            </Text>
            <View style={adminStyles.badges}>
              {user.is_admin ? <Badge label="Admin" color={colors.accent} /> : null}
              {user.is_demo ? <Badge label="Demo" color={colors.textMuted} /> : null}
              {user.disabled ? <Badge label="Desactivado" color={colors.danger} /> : null}
            </View>
          </View>
        ) : null}

        {s ? (
          <>
            <Text style={[adminStyles.section, styles.gap]}>CONSTANCIA</Text>
            <View style={[adminStyles.card, styles.kpis]}>
              <Kpi value={s.streak} label={s.streak === 1 ? 'día de racha' : 'días de racha'} />
              <Kpi value={s.bestStreak} label="mejor racha" />
              <Kpi value={s.weeks[0] ? `${Math.round(s.weeks[0].ratio * 100)}%` : '—'} label="esta semana" />
            </View>
            <Text style={adminStyles.hint}>
              Un día cuenta para la racha si hizo al menos la mitad de sus tareas. Último día con algo hecho:{' '}
              {s.lastDoneDate ? formatShortDate(s.lastDoneDate) : 'ninguno'}.
            </Text>

            <Text style={[adminStyles.section, styles.gap]}>TAREAS HECHAS POR SEMANA</Text>
            <View style={adminStyles.card}>
              {s.weeks.length === 0 ? <Text style={adminStyles.hint}>Sin actividad en las últimas 8 semanas.</Text> : null}
              {s.weeks.map((w) => (
                <View key={w.week_start} style={styles.weekRow}>
                  <Text style={styles.weekLabel}>{formatShortDate(w.week_start)}</Text>
                  <View style={{ flex: 1 }}>
                    <ProgressBar ratio={w.ratio} />
                  </View>
                  <Text style={styles.weekValue}>
                    {w.done}/{w.total}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[adminStyles.section, styles.gap]}>TIEMPO POR CATEGORÍA · 8 SEMANAS</Text>
            <View style={adminStyles.card}>
              {s.categories.length === 0 ? <Text style={adminStyles.hint}>Sin datos.</Text> : null}
              {s.categories.map((c) => {
                const cat = catOf(c.category_id);
                return (
                  <View key={c.category_id ?? 'none'} style={styles.weekRow}>
                    <View style={[styles.dot, { backgroundColor: cat?.color ?? colors.textFaint }]} />
                    <Text style={styles.catName} numberOfLines={1}>
                      {cat?.name ?? 'Sin categoría'}
                    </Text>
                    <Text style={styles.weekValue}>
                      {formatHours(c.minutes)} · {totalMinutes ? Math.round((c.minutes / totalMinutes) * 100) : 0}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {user ? (
          <>
            <Text style={[adminStyles.section, styles.gap]}>ACCIONES</Text>
            <View style={adminStyles.card}>
              {!user.is_demo ? (
                <SwitchRow
                  label="Google Calendar"
                  hint={user.google_email ? `Conectado como ${user.google_email}` : 'Puede conectar sus calendarios en Ajustes'}
                  value={user.gcal_allowed || Boolean(user.google_email)}
                  onChange={toggleGoogle}
                />
              ) : (
                <Text style={adminStyles.hint}>Cuenta de demostración: sin Google y con los datos restablecidos cada noche.</Text>
              )}
              <Pressable onPress={() => setPwOpen(true)} disabled={busy} style={adminStyles.action}>
                <Ionicons name="key-outline" size={18} color={colors.accent} />
                <Text style={adminStyles.actionText}>Cambiar contraseña</Text>
              </Pressable>
              {!isMe ? (
                <>
                  <Pressable onPress={toggleDisabled} disabled={busy} style={adminStyles.action}>
                    <Ionicons name={user.disabled ? 'play-circle-outline' : 'pause-circle-outline'} size={18} color={colors.accent} />
                    <Text style={adminStyles.actionText}>{user.disabled ? 'Reactivar' : 'Desactivar'}</Text>
                  </Pressable>
                  <Pressable onPress={remove} disabled={busy} style={adminStyles.action}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    <Text style={[adminStyles.actionText, { color: colors.danger }]}>Borrar usuario</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      <PasswordSheet
        visible={pwOpen}
        email={user?.email ?? ''}
        onClose={() => setPwOpen(false)}
        onSave={(password) => {
          setPwOpen(false);
          if (user) run(() => adminApi.setPassword(user.id, password), `Contraseña cambiada: ${password} — pásasela por un canal privado.`);
        }}
      />
    </View>
  );
}

function Kpi({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function PasswordSheet({ visible, email, onClose, onSave }: { visible: boolean; email: string; onClose: () => void; onSave: (p: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [prevVisible, setPrevVisible] = useState(false);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setPassword(adminApi.randomPassword());
      setError(null);
    }
  }
  return (
    <Sheet visible={visible} title="Cambiar contraseña" onClose={onClose}>
      <Text style={adminStyles.hint}>{email}</Text>
      <View>
        <Label>Contraseña nueva</Label>
        <View style={adminStyles.pwRow}>
          <Input value={password} onChangeText={setPassword} autoCapitalize="none" style={{ flex: 1 }} />
          <Pressable onPress={() => setPassword(adminApi.randomPassword())} hitSlop={8} accessibilityLabel="Generar otra">
            <Ionicons name="refresh" size={22} color={colors.accent} />
          </Pressable>
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton
        title="Guardar"
        onPress={() => (password.length < 8 ? setError('Mínimo 8 caracteres.') : onSave(password))}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: spacing.lg },
  kpis: { flexDirection: 'row', justifyContent: 'space-between' },
  kpi: { flex: 1, alignItems: 'center', gap: 2 },
  kpiValue: { color: colors.text, fontFamily: fonts.display, fontSize: 32 },
  kpiLabel: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  weekLabel: { width: 52, color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  weekValue: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  catName: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
