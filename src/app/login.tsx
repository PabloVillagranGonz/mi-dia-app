import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { auth, errorMessage } from '@/data';
import { colors, fonts, radius, spacing } from '@/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      await auth.signInDemo();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await auth.signIn(email, password);
      // El layout raíz detecta la sesión y abre la app.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Mi Día</Text>
          <Text style={styles.subtitle}>Tu rutina, momento a momento.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            placeholder="tu@email.com"
            placeholderTextColor={colors.textFaint}
            returnKeyType="next"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            placeholder="••••••••"
            placeholderTextColor={colors.textFaint}
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.8 }]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>Entrar</Text>}
          </Pressable>
          <Text style={styles.hint}>Solo tendrás que hacerlo una vez.</Text>

          {auth.demoAvailable ? (
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>¿Vienes a curiosear?</Text>
              <Pressable
                style={({ pressed }) => [styles.demoButton, (pressed || busy) && { opacity: 0.8 }]}
                onPress={demo}
                disabled={busy}
              >
                <Text style={styles.demoButtonText}>Probar la demo</Text>
              </Pressable>
              <Text style={styles.hint}>Una cuenta de ejemplo: toca lo que quieras, se restablece cada noche.</Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  header: { gap: spacing.xs },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 48, lineHeight: 52 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },
  form: { gap: spacing.sm },
  label: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.cardRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14, marginTop: spacing.sm },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  hint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  demoBox: { marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  demoTitle: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14, textAlign: 'center' },
  demoButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  demoButtonText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 16 },
});
