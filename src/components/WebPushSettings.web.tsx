// Panel de avisos de la versión web: activar en este dispositivo y enviar una prueba.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage, push } from '@/data';
import { enableWebPush, getWebPushState, type WebPushState } from '@/notifications/webPush';
import { colors, fonts, spacing } from '@/theme';

const MESSAGES: Record<Exclude<WebPushState, 'default' | 'enabled'>, string> = {
  install: 'Para recibir avisos en el iPhone, abre la app desde el icono de la pantalla de inicio (Safari → Compartir → Añadir a pantalla de inicio).',
  unsupported: 'Este navegador no admite avisos.',
  denied: 'Los avisos están bloqueados. Actívalos en Ajustes del iPhone → Notificaciones → Mi Día.',
};

export function WebPushSettings() {
  const [state, setState] = useState<WebPushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getWebPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  function enable() {
    setMsg(null);
    setBusy(true);
    // Sin awaits antes: iOS solo pide permiso si la llamada sale directamente del toque
    enableWebPush()
      .then((s) => {
        setState(s);
        if (s === 'enabled') setMsg('Listo: este dispositivo recibirá los avisos.');
      })
      .catch((e) => setMsg(errorMessage(e)))
      .finally(() => setBusy(false));
  }

  async function test() {
    setMsg(null);
    setBusy(true);
    try {
      const n = await push.sendTest();
      setMsg(n > 0 ? 'Enviada. Debería llegar en unos segundos.' : 'No hay ningún dispositivo suscrito. Vuelve a activar los avisos.');
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;

  return (
    <View>
      {state === 'default' ? (
        <Pressable onPress={enable} disabled={busy} style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.6 }]}>
          <Ionicons name="notifications-outline" size={18} color={colors.accent} />
          <Text style={styles.btnText}>Activar avisos en este dispositivo</Text>
        </Pressable>
      ) : null}

      {state === 'enabled' ? (
        <>
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.ok}>Avisos activados en este dispositivo</Text>
          </View>
          <Pressable onPress={test} disabled={busy} style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.6 }]}>
            <Ionicons name="paper-plane-outline" size={18} color={colors.accent} />
            <Text style={styles.btnText}>Enviar notificación de prueba</Text>
          </Pressable>
        </>
      ) : null}

      {state !== 'default' && state !== 'enabled' ? <Text style={styles.hint}>{MESSAGES[state]}</Text> : null}
      {msg ? <Text style={styles.hint}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingVertical: spacing.xs },
  btnText: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  ok: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  hint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.sm },
});
