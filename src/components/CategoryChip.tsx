import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Category } from '@/data';
import { colors, fonts, radius, spacing } from '@/theme';

export function CategoryDot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function CategoryChip({ category, selected, onPress }: { category: Category; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && { borderColor: category.color, backgroundColor: `${category.color}22` },
      ]}
    >
      <CategoryDot color={category.color} />
      <Text style={[styles.text, selected && { color: category.color }]}>{category.name}</Text>
    </Pressable>
  );
}

/** Fila desplazable de categorías para elegir una. */
export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {categories.map((c) => (
        <CategoryChip key={c.id} category={c} selected={c.id === value} onPress={() => onChange(c.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardRaised,
  },
  text: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  row: { gap: spacing.sm, paddingVertical: 2 },
});
