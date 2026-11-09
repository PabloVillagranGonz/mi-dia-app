// Ajustes → Google Calendar (issue #1). Solo aparece para los usuarios permitidos.
// Conectar abre la pantalla de permisos de Google en esta misma ventana; al terminar,
// Google vuelve a /ajustes?google=ok (o ?google=error&reason=…).

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage, google, repo, type GoogleCalendar } from '@/data';
import type { GoogleStatus } from '@/data/google';
import { useCategories } from '@/hooks/useCategories';
import { Alert } from '@/lib/alert';
import { colors, fonts, radius, spacing } from '@/theme';
import { CategoryPicker } from './CategoryChip';
import { ErrorText, SwitchRow } from './form';

export function GoogleCalendarSettings() {
  const params = useLocalSearchParams<{ google?: string; reason?: string }>();
  const { categories } = useCategories();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  // Vuelta desde Google (?google=ok | error&reason=…): el mensaje sale del primer render
  const [msg, setMsg] = useState<string | null>(() => (params.google === 'ok' ? 'Conectado. Trayendo tus eventos…' : null));
  const [error, setError] = useState<string | null>(() =>
    params.google && params.google !== 'ok' ? google.connectErrorMessage(params.reason ?? null) : null,
  );

  const load = useCallback(() => google.status().then(setStatus), []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!params.google) return;
    const ok = params.google === 'ok';
    router.setParams({ google: undefined, reason: undefined });
    if (!ok) return;
    // La primera sincronización va en segundo plano: volver a mirar en unos segundos
    const t = setTimeout(() => {
      load();
      repo.refresh();
      setMsg('Conectado.');
    }, 5000);
    return () => clearTimeout(t);
  }, [params.google, load]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function connect() {
    run(async () => {
      const url = await google.connectUrl();
      // En la PWA hay que quedarse en la misma ventana para volver a la app al terminar
      if (Platform.OS === 'web') window.location.assign(url);
      else await Linking.openURL(url);
    });
  }

  function disconnect() {
    Alert.alert(
      'Desconectar Google Calendar',
      'Se quitarán los eventos de Google de hoy en adelante y volverá tu rutina. Lo pasado no cambia.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await google.disconnect();
              await load();
              repo.refresh();
              setMsg('Desconectado.');
            }),
        },
      ],
    );
  }

  /** Guarda el cambio de un calendario y sincroniza (pone o quita sus eventos). */
  function change(cal: GoogleCalendar, patch: Partial<Pick<GoogleCalendar, 'enabled' | 'category_id'>>) {
    // Respuesta inmediata en pantalla
    setStatus((s) => s && { ...s, calendars: s.calendars.map((c) => (c.id === cal.id ? { ...c, ...patch } : c)) });
    run(async () => {
      try {
        await google.updateCalendar(cal.id, patch);
        await google.syncNow();
        repo.refresh();
      } catch (e) {
        await load(); // deshacer lo pintado
        throw e;
      }
    });
  }

  /** Ocultar o volver a mostrar en esta lista (no cambia nada más: no hace falta sincronizar). */
  function setHidden(cal: GoogleCalendar, hidden: boolean) {
    setStatus((s) => s && { ...s, calendars: s.calendars.map((c) => (c.id === cal.id ? { ...c, hidden } : c)) });
    run(async () => {
      try {
        await google.updateCalendar(cal.id, { hidden });
      } catch (e) {
        await load();
        throw e;
      }
    });
  }

  if (!status) return null;
  // Uno activo nunca se esconde: hay que desactivarlo antes
  const visible = status.calendars.filter((c) => !c.hidden || c.enabled);
  const hiddenCals = status.calendars.filter((c) => c.hidden && !c.enabled);

  return (
    <>
      <Text style={styles.section}>GOOGLE CALENDAR</Text>
      <View style={styles.card}>
        {!status.connected ? (
          <>
            <Text style={styles.hint}>
              Trae los eventos de los calendarios que elijas (solo lectura). Recortan la rutina como un evento y te avisan.
            </Text>
            <Pressable onPress={connect} disabled={busy} style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.6 }]}>
              <Ionicons name="logo-google" size={18} color={colors.accent} />
              <Text style={styles.btnText}>Conectar con Google</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.row}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.ok} numberOfLines={1}>
                Conectado como {status.email}
              </Text>
            </View>

            <View style={styles.list}>
              {status.calendars.length === 0 ? <Text style={styles.hint}>No hay calendarios en esta cuenta.</Text> : null}
              {visible.map((c) => (
                <View key={c.id} style={styles.cal}>
                  <View style={styles.calHead}>
                    <View style={[styles.dot, { backgroundColor: c.color ?? colors.textMuted }]} />
                    <View style={{ flex: 1 }}>
                      <SwitchRow label={c.summary} value={c.enabled} onChange={(v) => change(c, { enabled: v })} />
                    </View>
                    {!c.enabled ? (
                      <Pressable onPress={() => setHidden(c, true)} hitSlop={10} accessibilityLabel={`Ocultar ${c.summary}`}>
                        <Ionicons name="eye-off-outline" size={18} color={colors.textFaint} />
                      </Pressable>
                    ) : null}
                  </View>
                  {c.enabled ? (
                    <CategoryPicker categories={categories} value={c.category_id} onChange={(id) => change(c, { category_id: id })} />
                  ) : null}
                </View>
              ))}
            </View>

            {hiddenCals.length ? (
              <View>
                <Pressable onPress={() => setShowHidden((v) => !v)} style={styles.row} hitSlop={6}>
                  <Ionicons name={showHidden ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textMuted} />
                  <Text style={styles.hiddenToggle}>
                    {showHidden ? 'Ocultar la lista' : `Mostrar ocultos (${hiddenCals.length})`}
                  </Text>
                </Pressable>
                {showHidden
                  ? hiddenCals.map((c) => (
                      <View key={c.id} style={[styles.calHead, styles.hiddenRow]}>
                        <View style={[styles.dot, { backgroundColor: c.color ?? colors.textMuted, opacity: 0.5 }]} />
                        <Text style={styles.hiddenName} numberOfLines={1}>
                          {c.summary}
                        </Text>
                        <Pressable onPress={() => setHidden(c, false)} hitSlop={10} style={styles.row}>
                          <Ionicons name="eye-outline" size={18} color={colors.accent} />
                          <Text style={styles.showText}>Mostrar</Text>
                        </Pressable>
                      </View>
                    ))
                  : null}
              </View>
            ) : null}

            <Text style={styles.hint}>
              Los que no uses, desactívalos y ocúltalos con el ojo. Semana actual y siguiente. Los eventos de todo el día no se traen. Si un evento choca con tu rutina o con algo
              que hayas añadido, manda Google.
            </Text>
            <Pressable onPress={disconnect} disabled={busy} style={styles.btn}>
              <Ionicons name="unlink-outline" size={18} color={colors.danger} />
              <Text style={[styles.btnText, { color: colors.danger }]}>Desconectar</Text>
            </Pressable>
          </>
        )}
        {busy ? <Text style={styles.hint}>Un momento…</Text> : null}
        {msg ? <Text style={styles.hint}>{msg}</Text> : null}
        <ErrorText>{error}</ErrorText>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.textMuted, fontFamily: fonts.displaySemi, fontSize: 13, letterSpacing: 2, marginTop: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  hint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingVertical: spacing.xs },
  btnText: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ok: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  list: { gap: spacing.md, marginVertical: spacing.sm },
  cal: { gap: spacing.sm },
  calHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  hiddenToggle: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  hiddenRow: { marginTop: spacing.sm, paddingLeft: spacing.lg },
  hiddenName: { flex: 1, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  showText: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 13 },
});
