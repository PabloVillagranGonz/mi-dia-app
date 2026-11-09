// Administración (solo administradores): usuarios, alta y cuenta de demostración.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminHeader, adminStyles as styles, Badge } from '@/components/AdminUI';
import { ErrorText, Input, Label, PrimaryButton } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { adminApi, errorMessage, type AdminUser } from '@/data';
import type { DemoStatus } from '@/data/admin';
import { formatSince } from '@/domain/format';
import { useMyFlags } from '@/hooks/useMyFlags';
import { Alert } from '@/lib/alert';
import { colors, spacing } from '@/theme';

export default function AdminScreen() {
  const flags = useMyFlags();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [demo, setDemo] = useState<DemoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([adminApi.listUsers(), adminApi.demoStatus()]).then(
        ([u, d]) => {
          setUsers(u);
          setDemo(d);
          setError(null);
        },
        (e) => setError(errorMessage(e)),
      ),
    [],
  );

  useEffect(() => {
    if (flags.is_admin) load();
  }, [flags.is_admin, load]);

  function resetDemo() {
    const exists = (demo?.users ?? 0) > 0;
    Alert.alert(
      exists ? 'Restablecer la demo' : 'Crear la cuenta de demostración',
      exists
        ? 'Vuelve a poner los datos de ejemplo, el email y la contraseña, y cierra las sesiones abiertas. Ya se hace solo cada noche.'
        : `Se creará ${demo?.email} con la rutina de ejemplo. Se restablecerá cada noche.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: exists ? 'Restablecer' : 'Crear',
          onPress: async () => {
            setBusy(true);
            setMsg(null);
            try {
              await adminApi.resetDemo();
              setMsg(exists ? 'Demo restablecida.' : 'Cuenta de demostración creada.');
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

  if (!flags.is_admin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AdminHeader title="Administración" />
        <Text style={[styles.hint, { padding: spacing.lg }]}>No tienes acceso a esta sección.</Text>
      </SafeAreaView>
    );
  }

  const people = (users ?? []).filter((u) => !u.is_demo);
  const demoUser = (users ?? []).find((u) => u.is_demo);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AdminHeader title="Administración" />
      <ScrollView contentContainerStyle={styles.content}>
        <ErrorText>{error}</ErrorText>
        {msg ? <Text style={styles.ok}>{msg}</Text> : null}

        <View style={styles.sectionRow}>
          <Text style={styles.section}>USUARIOS{users ? ` · ${people.length}` : ''}</Text>
          <Pressable onPress={() => setCreating(true)} style={styles.addBtn} hitSlop={8}>
            <Ionicons name="person-add-outline" size={16} color={colors.accent} />
            <Text style={styles.addText}>Nuevo</Text>
          </Pressable>
        </View>

        {!users && !error ? <ActivityIndicator color={colors.accent} /> : null}
        {people.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}

        <Text style={[styles.section, { marginTop: spacing.lg }]}>CUENTA DE DEMOSTRACIÓN</Text>
        <View style={styles.card}>
          {!demo ? null : !demo.configured ? (
            <Text style={styles.hint}>
              Falta configurarla: añade los secretos DEMO_EMAIL y DEMO_PASSWORD en Supabase (Edge Functions → Secrets).
            </Text>
          ) : (
            <>
              <Text style={styles.email}>{demo.email}</Text>
              <Text style={styles.hint}>
                {demoUser
                  ? `Último acceso: ${formatSince(demoUser.last_sign_in_at)}. Sus datos, email y contraseña se restablecen cada noche de madrugada.`
                  : 'Aún no existe.'}
              </Text>
              <Pressable onPress={resetDemo} disabled={busy} style={({ pressed }) => [styles.action, (pressed || busy) && { opacity: 0.6 }]}>
                <Ionicons name={demoUser ? 'refresh' : 'add-circle-outline'} size={18} color={colors.accent} />
                <Text style={styles.actionText}>{demoUser ? 'Restablecer ahora' : 'Crear cuenta de demostración'}</Text>
              </Pressable>
              {demoUser ? (
                <Pressable onPress={() => router.push(`/admin/${demoUser.id}`)} style={styles.action}>
                  <Ionicons name="stats-chart-outline" size={18} color={colors.textMuted} />
                  <Text style={[styles.actionText, { color: colors.textMuted }]}>Ver uso</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <NewUserSheet
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(email, password) => {
          setCreating(false);
          setMsg(`Creado ${email}. Contraseña inicial: ${password} — pásasela por un canal privado.`);
          load();
        }}
      />
    </SafeAreaView>
  );
}

function UserRow({ user: u }: { user: AdminUser }) {
  return (
    <Pressable onPress={() => router.push(`/admin/${u.id}`)} style={({ pressed }) => [styles.card, styles.userRow, pressed && { opacity: 0.85 }]}>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={[styles.email, u.disabled && { color: colors.textFaint }]} numberOfLines={1}>
          {u.email}
        </Text>
        <Text style={styles.hint}>
          Último acceso: {formatSince(u.last_sign_in_at)} · {u.devices === 1 ? '1 dispositivo' : `${u.devices} dispositivos`} con avisos
        </Text>
        <View style={styles.badges}>
          {u.is_admin ? <Badge label="Admin" color={colors.accent} /> : null}
          {u.disabled ? <Badge label="Desactivado" color={colors.danger} /> : null}
          {u.google_email ? <Badge label="Google conectado" color={colors.success} /> : u.gcal_allowed ? <Badge label="Google permitido" color={colors.textMuted} /> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

function NewUserSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (email: string, password: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Al abrir: formulario limpio con una contraseña ya generada
  const [prevVisible, setPrevVisible] = useState(false);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setEmail('');
      setPassword(adminApi.randomPassword());
      setError(null);
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.createUser(email, password);
      onCreated(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Nuevo usuario" onClose={onClose}>
      <View>
        <Label>Email</Label>
        <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="nombre@email.com" />
      </View>
      <View>
        <Label>Contraseña inicial</Label>
        <View style={styles.pwRow}>
          <Input value={password} onChangeText={setPassword} autoCapitalize="none" style={{ flex: 1 }} />
          <Pressable onPress={() => setPassword(adminApi.randomPassword())} hitSlop={8} accessibilityLabel="Generar otra">
            <Ionicons name="refresh" size={22} color={colors.accent} />
          </Pressable>
        </View>
        <Text style={styles.hint}>Mínimo 8 caracteres. Se le crea la rutina de ejemplo, que luego cambia en la pestaña Rutina.</Text>
      </View>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton title={busy ? 'Creando…' : 'Crear usuario'} onPress={create} disabled={busy} />
    </Sheet>
  );
}
