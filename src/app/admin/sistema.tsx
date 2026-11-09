// Consola → Sistema: crons, llamadas a las Edge Functions y avisos de hoy.

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { AdminHeader, adminStyles as styles, Badge, Stat } from '@/components/AdminUI';
import { ErrorText } from '@/components/form';
import { adminApi, errorMessage } from '@/data';
import type { CronJobStatus, SystemStatus } from '@/data/admin';
import { formatSince } from '@/domain/format';
import { colors, spacing } from '@/theme';

const JOB_NAMES: Record<string, string> = {
  'mi-dia-push': 'Avisos (cada minuto)',
  'mi-dia-gcal-sync': 'Google Calendar (cada 15 min)',
  'mi-dia-demo-reset': 'Restablecer la demo (cada noche)',
};

function jobHealth(j: CronJobStatus): { label: string; color: string } {
  if (!j.active) return { label: 'Parado', color: colors.danger };
  if (j.last_status && j.last_status !== 'succeeded') return { label: 'Último falló', color: colors.danger };
  if (j.failures_24h > 0) return { label: `${j.failures_24h} fallos en 24 h`, color: colors.accent };
  return { label: 'Bien', color: colors.success };
}

export default function SistemaScreen() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    () =>
      adminApi.system().then(
        (d) => {
          setData(d);
          setError(null);
        },
        (e) => setError(errorMessage(e)),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  function refresh() {
    setLoading(true);
    load().finally(() => setLoading(false));
  }

  const allOk = data ? data.jobs.every((j) => jobHealth(j).color === colors.success) && data.http.errors === 0 : false;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AdminHeader title="Sistema" subtitle={data ? `Comprobado ${formatSince(data.checked_at)}` : undefined} />
      <ErrorText>{error}</ErrorText>
      {!data && !error ? <ActivityIndicator color={colors.accent} /> : null}

      {data ? (
        <>
          <View style={[styles.card, styles.row]}>
            <Ionicons name={allOk ? 'checkmark-circle' : 'alert-circle'} size={22} color={allOk ? colors.success : colors.accent} />
            <Text style={styles.rowMain}>{allOk ? 'Todo funciona' : 'Hay algo que revisar'}</Text>
            <Pressable onPress={refresh} disabled={loading} hitSlop={8} accessibilityLabel="Volver a comprobar">
              <Ionicons name="refresh" size={20} color={colors.accent} />
            </Pressable>
          </View>

          <View style={styles.stats}>
            <Stat value={data.push_sent_today} label="avisos enviados hoy" />
            <Stat value={data.push_devices} label="dispositivos suscritos" />
            <Stat
              value={data.http.errors}
              label={`errores en ${data.http.total} llamadas recientes`}
              tone={data.http.errors ? colors.danger : colors.success}
            />
          </View>

          <Text style={[styles.section, { marginTop: spacing.lg }]}>TAREAS PROGRAMADAS</Text>
          {data.jobs.map((j) => {
            const h = jobHealth(j);
            return (
              <View key={j.jobname} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.rowMain}>{JOB_NAMES[j.jobname] ?? j.jobname}</Text>
                  <Badge label={h.label} color={h.color} />
                </View>
                <Text style={styles.hint}>
                  {j.jobname} · {j.schedule} · última: {formatSince(j.last_start)} · {j.runs_24h} ejecuciones en 24 h
                </Text>
                {j.last_status && j.last_status !== 'succeeded' && j.last_message ? (
                  <Text style={[styles.hint, { color: colors.danger }]}>{j.last_message}</Text>
                ) : null}
              </View>
            );
          })}

          {data.http.last_error ? (
            <>
              <Text style={[styles.section, { marginTop: spacing.lg }]}>ÚLTIMO ERROR DE UNA FUNCIÓN</Text>
              <View style={styles.card}>
                <Text style={styles.hint}>
                  {formatSince(data.http.last_error.at)} · {data.http.last_error.status ?? 'sin respuesta'}
                </Text>
                <Text style={[styles.hint, { color: colors.danger }]}>{data.http.last_error.message}</Text>
                <Text style={styles.hint}>Detalle en Supabase → Edge Functions → Logs.</Text>
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
