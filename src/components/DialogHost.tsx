// Pinta los diálogos de la app (web). En nativo no recibe nada: allí se usa el Alert del sistema.

import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { closeDialog, currentDialog, subscribeDialogs } from '@/lib/dialog';
import { colors, fonts, radius, spacing } from '@/theme';

export function DialogHost() {
  const dialog = useSyncExternalStore(subscribeDialogs, currentDialog, currentDialog);
  if (!dialog) return null;

  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  const actions = dialog.buttons.filter((b) => b !== cancel);
  // Botones con texto largo, uno debajo de otro; si no, en fila (cancelar a la izquierda)
  const stacked = dialog.buttons.some((b) => (b.text ?? '').length > 16);
  const ordered = stacked ? [...actions, ...(cancel ? [cancel] : [])] : [...(cancel ? [cancel] : []), ...actions];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => closeDialog(dialog.id, cancel)}>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => cancel && closeDialog(dialog.id, cancel)} accessibilityLabel="Cerrar" />
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          <View style={[styles.buttons, stacked && styles.stacked]}>
            {ordered.map((b, i) => {
              const isCancel = b === cancel;
              const destructive = b.style === 'destructive';
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => closeDialog(dialog.id, b)}
                  style={({ pressed }) => [
                    styles.button,
                    !stacked && { flex: 1 },
                    isCancel ? styles.cancel : destructive ? styles.destructive : styles.primary,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.buttonText, isCancel && { color: colors.textMuted }]}>{b.text ?? 'Aceptar'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(0,0,0,0.6)' },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  message: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  stacked: { flexDirection: 'column' },
  button: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  primary: { backgroundColor: colors.accent },
  destructive: { backgroundColor: colors.danger },
  cancel: { backgroundColor: colors.cardRaised },
  buttonText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, textAlign: 'center' },
});
