// Consola → Google Calendar: quién tiene acceso, quién está conectado y si sus avisos están al día.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { AdminHeader, adminStyles as styles, Badge } from '@/components/AdminUI';
import { ErrorText } from '@/components/form';
import { adminApi, errorMessage } from '@/data';
import type { AdminGoogleUser } from '@/data/admin';
import { formatSince } from '@/domain/format';
import { colors, spacing } from '@/theme';

function channelState(expires: string | null): { label: string; color: string } | null {
  if (!expires) return null;
  const left = new Date(expires).getTime() - Date.now();
  if (left <= 0) return { label: 'Avisos caducados', color: colors.danger };
  const days = Math.floor(left / 86_400_000);
  return { label: `Avisos activos · ${days} d`, color: colors.success };
}

export default function GoogleScreen() {
  const [users, setUsers] = useState<AdminGoogleUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.googleUsers().then(setUsers, (e) => setError(errorMessage(e)));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AdminHeader title="Google Calendar" subtitle="El acceso se da o se quita desde la ficha de cada usuario" />
      <ErrorText>{error}</ErrorText>
      {!users && !error ? <ActivityIndicator color={colors.accent} /> : null}
      {users && users.length === 0 ? <Text style={styles.hint}>Nadie tiene acceso todavía.</Text> : null}

      {(users ?? []).map((u) => {
        const ch = channelState(u.channel_expires_at);
        return (
          <Pressable key={u.id} onPress={() => router.push(`/admin/usuarios/${u.id}`)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
            <Text style={styles.email}>{u.email}</Text>
            <Text style={styles.hint}>
              {u.google_email ? `Conectado como ${u.google_email} · ${formatSince(u.connected_at)}` : 'Con acceso, sin conectar todavía'}
            </Text>
            {u.google_email ? (
              <Text style={[styles.hint, { marginTop: spacing.xs }]}>
                {u.calendars.length ? `Calendarios: ${u.calendars.join(', ')}` : 'Ningún calendario activado'} · {u.events} eventos en la
                ventana
              </Text>
            ) : null}
            <View style={styles.badges}>
              {!u.allowed ? <Badge label="Acceso quitado" color={colors.danger} /> : null}
              {ch ? <Badge label={ch.label} color={ch.color} /> : null}
            </View>
          </Pressable>
        );
      })}
      <Text style={[styles.hint, { marginTop: spacing.md }]}>
        Los avisos al momento de Google duran 7 días y se renuevan solos (cron cada 15 min). Si salen caducados, revisa Sistema.
      </Text>
    </ScrollView>
  );
}
