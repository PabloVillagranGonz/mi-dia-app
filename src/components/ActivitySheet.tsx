// Hoja para editar una actividad de un día o crear un evento / actividad (spec §5 y §8).

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Alert } from '@/lib/alert';

import { errorMessage, repo, type ActivityKind, type Category, type DayActivity, type HHMM, type ISODate } from '@/data';
import { crossesMidnight } from '@/domain/midnight';
import { colors, fonts, spacing } from '@/theme';
import { CategoryPicker } from './CategoryChip';
import { ErrorText, Input, Label, PrimaryButton, Segmented, SwitchRow, TimeField } from './form';
import { Sheet } from './Sheet';

export type SheetTarget =
  | { mode: 'edit'; activity: DayActivity }
  | { mode: 'create'; date: ISODate; start: HHMM; end: HHMM };

interface Props {
  target: SheetTarget | null;
  categories: Category[];
  /** Hoy: se puede marcar como hecho. */
  canCheck: boolean;
  /** Día pasado: todo en solo lectura. */
  readOnly?: boolean;
  onClose: () => void;
}

export function ActivitySheet({ target, categories, canCheck, readOnly: pastDay = false, onClose }: Props) {
  const editing = target?.mode === 'edit' ? target.activity : null;
  // Los eventos de Google Calendar solo se cambian en Google: aquí, hecho y nota
  const fromGoogle = Boolean(editing?.external_id);
  const readOnly = pastDay || fromGoogle;
  const defaultCategory = categories.find((c) => c.name === 'Personal')?.id ?? categories[0]?.id ?? null;

  const [title, setTitle] = useState('');
  const [start, setStart] = useState<HHMM>('09:00');
  const [end, setEnd] = useState<HHMM>('10:00');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [kind, setKind] = useState<ActivityKind>('task');
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState('');
  const [origin, setOrigin] = useState<'event' | 'manual'>('event');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rellenar el formulario al abrir (al cambiar `target`, durante el render: sin efecto)
  const [prevTarget, setPrevTarget] = useState<SheetTarget | null>(null);
  if (target !== prevTarget) {
    setPrevTarget(target);
    setError(null);
    if (!target) {
      // cerrada: se deja el formulario como estaba para que no parpadee al deslizarse
    } else if (target.mode === 'edit') {
      const a = target.activity;
      setTitle(a.title);
      setStart(a.start_time);
      setEnd(a.end_time === '24:00' ? '00:00' : a.end_time);
      setCategoryId(a.category_id);
      setKind(a.kind);
      setNotify(a.notify);
      setNote(a.note ?? '');
    } else {
      setTitle('');
      setStart(target.start);
      setEnd(target.end);
      setCategoryId(defaultCategory);
      setKind('task');
      setNotify(true);
      setNote('');
      setOrigin('event');
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const input = { title, start_time: start, end_time: end, category_id: categoryId, kind, notify };

  function save() {
    run(async () => {
      if (!target) return;
      if (target.mode === 'create') {
        if (origin === 'event') await repo.addEvent(target.date, input);
        else await repo.addManual(target.date, input);
        return;
      }
      const a = target.activity;
      const changed =
        a.title !== title.trim() ||
        a.start_time !== start ||
        (a.end_time === '24:00' ? '00:00' : a.end_time) !== end ||
        a.category_id !== categoryId ||
        a.kind !== kind ||
        a.notify !== notify;
      if (changed && !fromGoogle) await repo.updateActivity(a.id, input);
      if ((a.note ?? '') !== note.trim()) await repo.setNote(a.id, note);
    });
  }

  function toggleDone() {
    if (!editing) return;
    run(() => repo.toggleDone(editing.id));
  }

  function remove() {
    if (!editing) return;
    Alert.alert('Eliminar actividad', `¿Eliminar «${editing.title}» de este día? El hueco quedará como tiempo libre.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => run(() => repo.deleteActivity(editing.id)) },
    ]);
  }

  const title_ = target?.mode === 'create' ? 'Añadir al día' : fromGoogle ? 'Evento de Google' : readOnly ? 'Actividad' : 'Editar actividad';
  const splits = (() => {
    try {
      return crossesMidnight(start, end);
    } catch {
      return false;
    }
  })();

  return (
    <Sheet
      visible={!!target}
      title={title_}
      onClose={onClose}
      headerAction={
        editing && !readOnly ? (
          <Pressable onPress={remove} hitSlop={12} accessibilityLabel="Eliminar">
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        ) : null
      }
    >
      {target?.mode === 'create' ? (
        <View style={styles.block}>
          <Segmented
            value={origin}
            onChange={setOrigin}
            options={[
              { value: 'event', label: 'Evento' },
              { value: 'manual', label: 'Actividad' },
            ]}
          />
          <Text style={styles.hint}>
            {origin === 'event'
              ? 'Un evento (ensayo, bolo, cita…) recorta o sustituye lo que pise de la rutina.'
              : 'Una actividad suelta para este día. No puede solaparse con otras.'}
          </Text>
        </View>
      ) : null}

      {fromGoogle ? (
        <View style={styles.google}>
          <Ionicons name="logo-google" size={14} color={colors.textMuted} />
          <Text style={styles.googleText}>Viene de Google Calendar. Para cambiarlo o borrarlo, hazlo allí.</Text>
        </View>
      ) : null}

      {editing && canCheck ? (
        <PrimaryButton title={editing.done ? '✓ Hecha · desmarcar' : 'Marcar como hecha'} onPress={toggleDone} disabled={busy} />
      ) : null}

      <View>
        <Label>Título</Label>
        <Input value={title} onChangeText={setTitle} editable={!readOnly} placeholder="Ensayo, médico, leer…" />
      </View>

      <View style={styles.row}>
        <TimeField label="Hora de inicio" value={start} onChange={setStart} disabled={readOnly} />
        <TimeField label="Hora de fin" value={end} onChange={setEnd} disabled={readOnly} />
      </View>
      {splits ? <Text style={styles.hint}>Cruza la medianoche: se partirá en dos (hasta las 24:00 y desde las 00:00 del día siguiente).</Text> : null}

      <View>
        <Label>Categoría</Label>
        <CategoryPicker categories={categories} value={categoryId} onChange={(id) => !readOnly && setCategoryId(id)} />
      </View>

      <View>
        <Label>Tipo</Label>
        <Segmented
          value={kind}
          onChange={(k) => !readOnly && setKind(k)}
          options={[
            { value: 'task', label: 'Tarea' },
            { value: 'fixed', label: 'Fija' },
          ]}
        />
        <Text style={styles.hint}>Las tareas cuentan para el progreso; las fijas no.</Text>
      </View>

      <SwitchRow label="Aviso" hint="Notificación al empezar" value={notify} onChange={(v) => !readOnly && setNotify(v)} />

      {target?.mode === 'edit' ? (
        <View>
          <Label>Nota (opcional)</Label>
          <Input
            value={note}
            onChangeText={setNote}
            editable={!pastDay}
            placeholder="Nota para hoy…"
            multiline
            style={styles.note}
          />
        </View>
      ) : null}

      <ErrorText>{error}</ErrorText>

      {fromGoogle && !pastDay ? (
        <View style={styles.actions}>
          <PrimaryButton title="Guardar nota" onPress={save} disabled={busy} />
        </View>
      ) : null}

      {!readOnly ? (
        <View style={styles.actions}>
          <PrimaryButton title={target?.mode === 'create' ? 'Añadir' : 'Guardar cambios'} onPress={save} disabled={busy} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  hint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.xs },
  note: { minHeight: 80, textAlignVertical: 'top' },
  actions: { gap: spacing.xs, marginTop: spacing.sm },
  google: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  googleText: { flex: 1, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
});
