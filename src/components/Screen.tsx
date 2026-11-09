import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, spacing } from '@/theme';

interface Props {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  scroll?: boolean;
}

/** Contenedor común de pantalla: fondo oscuro, márgenes y título condensado. */
export function Screen({ title, subtitle, children, scroll = true }: Props) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Body
        style={styles.body}
        contentContainerStyle={scroll ? styles.content : undefined}
      >
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {children}
      </Body>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 34, lineHeight: 38 },
});
