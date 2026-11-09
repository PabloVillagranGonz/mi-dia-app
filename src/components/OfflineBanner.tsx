import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useOffline } from '@/hooks/useOffline';
import { colors, fonts, radius, spacing } from '@/theme';

/** Aviso cuando se muestra lo último guardado y no se pueden guardar cambios. */
export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.textMuted} />
      <Text style={styles.text}>
        Sin conexión. Ves lo último guardado; los cambios no se guardarán hasta que vuelva internet.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  text: { flex: 1, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
});
