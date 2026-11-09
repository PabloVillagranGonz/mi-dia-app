// Consola → Resumen: cómo va Mi Día esta semana.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { AdminHeader, adminStyles as styles, Stat } from '@/components/AdminUI';
import { ErrorText } from '@/components/form';
import { ProgressBar } from '@/components/ProgressBar';
import { adminApi, errorMessage } from '@/data';
import type { AdminOverview } from '@/data/admin';
import { formatSince } from '@/domain/format';
import { formatShortDate } from '@/domain/time';
import { colors, spacing } from '@/theme';

export default function ResumenScreen() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.overview().then(setData, (e) => setError(errorMessage(e)));
  }, []);

  const pct = data && data.tasks.total ? Math.round((data.tasks.done / data.tasks.total) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AdminHeader title="Resumen" subtitle={data ? `Semana del ${formatShortDate(data.week_start)}` : undefined} />
      <ErrorText>{error}</ErrorText>
      {!data && !error ? <ActivityIndicator color={colors.accent} /> : null}

      {data ? (
        <>
          <View style={styles.stats}>
            <Stat value={data.users} label={data.users === 1 ? 'usuario' : 'usuarios'} />
            <Stat value={data.active_7d} label="activos esta semana" tone={colors.success} />
            <Stat value={`${pct}%`} label={`tareas hechas (${data.tasks.done}/${data.tasks.total})`} tone={colors.accent} />
            <Stat value={data.devices} label="dispositivos con avisos" />
          </View>

          <Text style={[styles.section, { marginTop: spacing.lg }]}>ESTA SEMANA, POR USUARIO</Text>
          <View style={styles.card}>
            {data.ranking.length === 0 ? <Text style={styles.hint}>Sin usuarios todavía.</Text> : null}
            {data.ranking.map((u) => (
              <Pressable key={u.id} onPress={() => router.push(`/admin/usuarios/${u.id}`)} style={styles.row}>
                <Text style={styles.rowMain} numberOfLines={1}>
                  {u.email}
                </Text>
                <View style={{ width: 120 }}>
                  <ProgressBar ratio={u.total ? u.done / u.total : 0} />
                </View>
                <Text style={[styles.rowSide, { width: 52, textAlign: 'right' }]}>
                  {u.done}/{u.total}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.section, { marginTop: spacing.lg }]}>ALTAS EN LOS ÚLTIMOS 30 DÍAS</Text>
          <View style={styles.card}>
            {data.recent.length === 0 ? <Text style={styles.hint}>Ninguna.</Text> : null}
            {data.recent.map((u) => (
              <View key={u.id} style={styles.row}>
                <Text style={styles.rowMain} numberOfLines={1}>
                  {u.email}
                </Text>
                <Text style={styles.rowSide}>{formatSince(u.created_at)}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.section, { marginTop: spacing.lg }]}>DEMO</Text>
          <Pressable onPress={() => router.push('/admin/demo')} style={[styles.card, styles.row]}>
            <Text style={styles.rowMain}>{data.demo ? data.demo.email : 'Sin cuenta de demostración'}</Text>
            <Text style={styles.rowSide}>{data.demo ? `último acceso: ${formatSince(data.demo.last_sign_in_at)}` : ''}</Text>
          </Pressable>
          {data.disabled ? <Text style={styles.hint}>{data.disabled} usuario(s) desactivado(s).</Text> : null}
        </>
      ) : null}
    </ScrollView>
  );
}
