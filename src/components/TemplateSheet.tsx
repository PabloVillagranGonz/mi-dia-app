// Hoja para crear/editar una actividad de la rutina base, y para «Copiar este día a…».

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Alert } from '@/lib/alert';

import { errorMessage, repo, type ActivityKind, type Category, type HHMM, type TemplateActivity, type Weekday } from '@/data';
import { crossesMidnight } from '@/domain/midnight';
import { weekdayName, weekdayShort } from '@/domain/time';
import { colors, fonts, radius, spacing } from '@/theme';
import { CategoryPicker } from './CategoryChip';
import { ErrorText, Input, Label, PrimaryButton, Segmented, SwitchRow, TimeField } from './form';
import { Sheet } from './Sheet';

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export type TemplateTarget = { mode: 'edit'; template: TemplateActivity } | { mode: 'create'; weekday: Weekday };

/** Tras guardar la rutina: «¿Aplicar también a los días que quedan de esta semana?» (spec §2). */
export function askApplyToWeek() {
  Alert.alert('Rutina guardada', '¿Aplicar también a los días que quedan de esta semana? (Hoy no se toca.)', [
    { text: 'Solo próximas semanas', style: 'cancel' },
    {
      text: 'También el resto de esta semana',
      onPress: () =>
        repo.applyTemplateToCurrentWeek().catch((e) => Alert.alert('No se pudo aplicar', errorMessage(e))),
    },
  ]);
}

export function TemplateSheet({
  target,
  categories,
  onClose,
}: {
  target: TemplateTarget | null;
  categories: Category[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState<HHMM>('09:00');
  const [end, setEnd] = useState<HHMM>('10:00');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [kind, setKind] = useState<ActivityKind>('task');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rellenar el formulario al abrir (durante el render, sin efecto)
  const [prevTarget, setPrevTarget] = useState<TemplateTarget | null>(null);
  if (target !== prevTarget) {
    setPrevTarget(target);
    setError(null);
    if (!target) {
      // cerrada: se deja como estaba
    } else if (target.mode === 'edit') {
      const t = target.template;
      setTitle(t.title);
      setStart(t.start_time);
      setEnd(t.end_time === '24:00' ? '00:00' : t.end_time);
      setCategoryId(t.category_id);
      setKind(t.kind);
      setNotify(t.notify);
    } else {
      setTitle('');
      setStart('16:00');
      setEnd('18:00');
      setCategoryId(categories[0]?.id ?? null);
      setKind('task');
      setNotify(true);
    }
  }

  const weekday = target?.mode === 'edit' ? target.template.weekday : target?.weekday;

  async function save() {
    if (!target || !weekday) return;
    setBusy(true);
    setError(null);
    try {
      await repo.saveTemplate(
        { weekday, title, start_time: start, end_time: end, category_id: categoryId, kind, notify },
        target.mode === 'edit' ? target.template.id : undefined,
      );
      onClose();
      askApplyToWeek();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (target?.mode !== 'edit') return;
    const t = target.template;
    Alert.alert('Eliminar de la rutina', `¿Eliminar «${t.title}» de los ${weekdayName(t.weekday)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await repo.deleteTemplate(t.id);
            onClose();
            askApplyToWeek();
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);
  }

  let splits = false;
  try {
    splits = crossesMidnight(start, end);
  } catch {
    splits = false;
  }

  return (
    <Sheet
      visible={!!target}
      title={target?.mode === 'edit' ? 'Editar actividad' : 'Nueva actividad'}
      onClose={onClose}
      headerAction={
        target?.mode === 'edit' ? (
          <Pressable onPress={remove} hitSlop={12} accessibilityLabel="Eliminar">
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        ) : null
      }
    >
      {weekday ? <Text style={styles.day}>Rutina de los {weekdayName(weekday)}</Text> : null}
      <View>
        <Label>Título</Label>
        <Input value={title} onChangeText={setTitle} placeholder="Practicar instrumento, deporte…" />
      </View>
      <View style={styles.row}>
        <TimeField label="Hora de inicio" value={start} onChange={setStart} />
        <TimeField label="Hora de fin" value={end} onChange={setEnd} />
      </View>
      {splits ? (
        <Text style={styles.hint}>Cruza la medianoche: se guardará partida entre este día y el siguiente.</Text>
      ) : null}
      <View>
        <Label>Categoría</Label>
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      </View>
      <View>
        <Label>Tipo</Label>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'task', label: 'Tarea' },
            { value: 'fixed', label: 'Fija' },
          ]}
        />
      </View>
      <SwitchRow label="Aviso" hint="Notificación al empezar" value={notify} onChange={setNotify} />
      <ErrorText>{error}</ErrorText>
      <PrimaryButton title={target?.mode === 'edit' ? 'Guardar cambios' : 'Añadir a la rutina'} onPress={save} disabled={busy} />
    </Sheet>
  );
}

/** «Copiar este día a…»: selector de días destino. */
export function CopyDaySheet({ from, onClose }: { from: Weekday | null; onClose: () => void }) {
  const [selected, setSelected] = useState<Weekday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [prevFrom, setPrevFrom] = useState(from);
  if (from !== prevFrom) {
    setPrevFrom(from);
    setSelected([]);
    setError(null);
  }

  const toggle = (w: Weekday) => setSelected((s) => (s.includes(w) ? s.filter((x) => x !== w) : [...s, w]));

  function confirm() {
    if (!from || !selected.length) return;
    const names = selected.map((w) => weekdayName(w)).join(', ');
    Alert.alert('Copiar rutina', `Se sustituirá la rutina de: ${names}. ¿Continuar?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Copiar',
        onPress: async () => {
          try {
            await repo.copyTemplateDay(from, selected);
            onClose();
            askApplyToWeek();
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <Sheet visible={from != null} title={`Copiar el ${from ? weekdayName(from) : ''} a…`} onClose={onClose}>
      <Text style={styles.hint}>La rutina de los días que elijas se sustituirá por la de este día.</Text>
      <View style={styles.days}>
        {WEEKDAYS.filter((w) => w !== from).map((w) => {
          const on = selected.includes(w);
          return (
            <Pressable key={w} onPress={() => toggle(w)} style={[styles.dayBtn, on && styles.dayBtnOn]}>
              <Text style={[styles.dayBtnText, on && { color: colors.text }]}>{weekdayShort(w)}</Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton title="Copiar" onPress={confirm} disabled={!selected.length} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  day: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  row: { flexDirection: 'row', gap: spacing.md },
  hint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 13 },
  days: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  dayBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.cardRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayBtnText: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 18 },
});
