// Categorías (spec §5): nombre, color de una paleta y orden. Crear, editar y borrar.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryDot } from '@/components/CategoryChip';
import { ErrorText, Input, Label, PrimaryButton, TextButton } from '@/components/form';
import { Sheet } from '@/components/Sheet';
import { errorMessage, repo, type Category } from '@/data';
import { useCategories } from '@/hooks/useCategories';
import { colors, fonts, radius, spacing } from '@/theme';

const PALETTE = [
  '#4F8CFF', '#B07CFF', '#34D399', '#F5B544', '#F472B6',
  '#22D3EE', '#FB923C', '#A3E635', '#F87171', '#94A3B8',
];

type Target = { mode: 'edit'; category: Category } | { mode: 'create' };

export default function CategoriasScreen() {
  const { categories } = useCategories();
  const [target, setTarget] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function move(index: number, dir: -1 | 1) {
    const a = categories[index];
    const b = categories[index + dir];
    if (!a || !b) return;
    setError(null);
    try {
      // Reasignar el orden a toda la lista para evitar empates
      const ordered = [...categories];
      ordered[index] = b;
      ordered[index + dir] = a;
      await Promise.all(
        ordered.map((c, i) => (c.sort_order !== i ? repo.saveCategory({ name: c.name, color: c.color, sort_order: i }, c.id) : null)),
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
          <Text style={styles.backText}>Atrás</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Categorías</Text>
        <Text style={styles.subtitle}>Colorean los bloques de tu día. Toca una para editarla.</Text>
        <ErrorText>{error}</ErrorText>

        {categories.map((c, i) => (
          <Pressable key={c.id} onPress={() => setTarget({ mode: 'edit', category: c })} style={styles.row}>
            <CategoryDot color={c.color} size={14} />
            <Text style={styles.name}>{c.name}</Text>
            <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={8}>
              <Ionicons name="chevron-up" size={20} color={i === 0 ? colors.border : colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => move(i, 1)} disabled={i === categories.length - 1} hitSlop={8}>
              <Ionicons name="chevron-down" size={20} color={i === categories.length - 1 ? colors.border : colors.textMuted} />
            </Pressable>
          </Pressable>
        ))}

        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton title="+  Nueva categoría" onPress={() => setTarget({ mode: 'create' })} />
        </View>
      </ScrollView>

      <CategorySheet target={target} nextOrder={categories.length} onClose={() => setTarget(null)} />
    </SafeAreaView>
  );
}

function CategorySheet({ target, nextOrder, onClose }: { target: Target | null; nextOrder: number; onClose: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (target?.mode === 'edit') {
      setName(target.category.name);
      setColor(target.category.color);
    } else if (target) {
      setName('');
      setColor(PALETTE[nextOrder % PALETTE.length]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  async function save() {
    if (!target) return;
    try {
      if (target.mode === 'edit') {
        await repo.saveCategory({ name, color, sort_order: target.category.sort_order }, target.category.id);
      } else {
        await repo.saveCategory({ name, color, sort_order: nextOrder });
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function remove() {
    if (target?.mode !== 'edit') return;
    const c = target.category;
    Alert.alert('Eliminar categoría', `¿Eliminar «${c.name}»? Las actividades que la usan quedarán sin categoría.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await repo.deleteCategory(c.id);
            onClose();
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <Sheet visible={!!target} title={target?.mode === 'edit' ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}>
      <View>
        <Label>Nombre</Label>
        <Input value={name} onChangeText={setName} placeholder="Música, Familia…" />
      </View>
      <View>
        <Label>Color</Label>
        <View style={styles.palette}>
          {PALETTE.map((p) => (
            <Pressable key={p} onPress={() => setColor(p)} style={[styles.swatch, { backgroundColor: p }, color === p && styles.swatchOn]}>
              {color === p ? <Ionicons name="checkmark" size={18} color="#111" /> : null}
            </Pressable>
          ))}
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton title={target?.mode === 'edit' ? 'Guardar cambios' : 'Crear categoría'} onPress={save} />
      {target?.mode === 'edit' ? <TextButton title="Eliminar" color={colors.danger} onPress={remove} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { color: colors.text, fontFamily: fonts.medium, fontSize: 16 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  name: { flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
});
