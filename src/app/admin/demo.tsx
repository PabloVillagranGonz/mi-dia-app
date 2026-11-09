// Consola → Demo: la cuenta pública del portfolio.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { AdminHeader, adminStyles as styles } from '@/components/AdminUI';
import { ErrorText } from '@/components/form';
import { adminApi, errorMessage, type AdminUser } from '@/data';
import type { DemoStatus } from '@/data/admin';
import { formatSince } from '@/domain/format';
import { Alert } from '@/lib/alert';
import { colors, spacing } from '@/theme';

export default function DemoScreen() {
  const [demo, setDemo] = useState<DemoStatus | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([adminApi.demoStatus(), adminApi.listUsers()]).then(
        ([d, users]) => {
          setDemo(d);
          setUser(users.find((u) => u.is_demo) ?? null);
          setError(null);
        },
        (e) => setError(errorMessage(e)),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    Alert.alert(
      user ? 'Restablecer la demo' : 'Crear la cuenta de demostración',
      user
        ? 'Vuelve a poner los datos de ejemplo, el email y la contraseña, y cierra las sesiones abiertas. Ya se hace solo cada noche.'
        : `Se creará ${demo?.email} con la rutina de ejemplo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: user ? 'Restablecer' : 'Crear',
          onPress: async () => {
            setBusy(true);
            setMsg(null);
            try {
              await adminApi.resetDemo();
              setMsg(user ? 'Demo restablecida.' : 'Cuenta de demostración creada.');
              await load();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AdminHeader title="Demo" subtitle="La cuenta pública para quien llega desde el portfolio" />
      <ErrorText>{error}</ErrorText>
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
      {!demo && !error ? <ActivityIndicator color={colors.accent} /> : null}

      {demo && !demo.configured ? (
        <View style={styles.card}>
          <Text style={styles.hint}>Falta configurarla: añade los secretos DEMO_EMAIL y DEMO_PASSWORD en Supabase (Edge Functions → Secrets).</Text>
        </View>
      ) : null}

      {demo?.configured ? (
        <View style={styles.card}>
          <Text style={styles.email}>{demo.email}</Text>
          <Text style={styles.hint}>
            {user ? `Último acceso: ${formatSince(user.last_sign_in_at)}.` : 'Aún no existe.'} En el login sale el botón «Probar la demo».
          </Text>
          <Text style={[styles.hint, { marginTop: spacing.sm }]}>
            Cada noche (04:00 UTC) se le restablecen los datos de ejemplo, el email y la contraseña, y se cierran sus sesiones. No
            ve Google Calendar ni avisos al móvil.
          </Text>
          <Pressable onPress={reset} disabled={busy} style={({ pressed }) => [styles.action, (pressed || busy) && { opacity: 0.6 }]}>
            <Ionicons name={user ? 'refresh' : 'add-circle-outline'} size={18} color={colors.accent} />
            <Text style={styles.actionText}>{user ? 'Restablecer ahora' : 'Crear cuenta de demostración'}</Text>
          </Pressable>
          {user ? (
            <Pressable onPress={() => router.push(`/admin/usuarios/${user.id}`)} style={styles.action}>
              <Ionicons name="stats-chart-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.actionText, { color: colors.textMuted }]}>Ver cómo la usan</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
