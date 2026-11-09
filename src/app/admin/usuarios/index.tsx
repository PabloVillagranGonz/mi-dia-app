// Consola → Usuarios: lista, alta y acceso a la ficha de cada uno.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { AdminHeader, adminStyles as styles, Badge } from '@/components/AdminUI';
import { ErrorText, Input, Label, PrimaryButton } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { adminApi, errorMessage, type AdminUser } from '@/data';
import { formatSince } from '@/domain/format';
import { colors, spacing } from '@/theme';

export default function UsuariosScreen() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    () =>
      adminApi.listUsers().then(
        (u) => {
          setUsers(u);
          setError(null);
        },
        (e) => setError(errorMessage(e)),
      ),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  // La demo tiene su sección y la cuenta de administración no usa la app
  const people = (users ?? []).filter((u) => !u.is_demo && !u.is_admin);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <AdminHeader title="Usuarios" subtitle={users ? `${people.length} ${people.length === 1 ? 'persona usa' : 'personas usan'} Mi Día` : undefined} />
        <ErrorText>{error}</ErrorText>
        {msg ? <Text style={styles.ok}>{msg}</Text> : null}

        <View style={styles.sectionRow}>
          <Text style={styles.section}>CUENTAS</Text>
          <Pressable onPress={() => setCreating(true)} style={styles.addBtn} hitSlop={8}>
            <Ionicons name="person-add-outline" size={16} color={colors.accent} />
            <Text style={styles.addText}>Nuevo usuario</Text>
          </Pressable>
        </View>

        {!users && !error ? <ActivityIndicator color={colors.accent} /> : null}
        {users && people.length === 0 ? <Text style={styles.hint}>Todavía no hay usuarios. Crea el primero con «Nuevo usuario».</Text> : null}
        {people.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}
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
    </View>
  );
}

function UserRow({ user: u }: { user: AdminUser }) {
  return (
    <Pressable onPress={() => router.push(`/admin/usuarios/${u.id}`)} style={({ pressed }) => [styles.card, styles.userRow, pressed && { opacity: 0.85 }]}>
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
