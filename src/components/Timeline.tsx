// Línea de tiempo de un día (Hoy y vista de cualquier día).

import { View, type LayoutChangeEvent } from 'react-native';

import type { Category, DayActivity } from '@/data';
import { toMinutes } from '@/domain/time';
import { buildTimeline } from '@/domain/timeline';
import { GapBlock, TimelineBlock } from './TimelineBlock';

interface Props {
  activities: DayActivity[];
  categoryOf: (id: string | null) => Category | undefined;
  /** Minutos actuales si es hoy; null en otros días. */
  nowMinutes: number | null;
  canCheck: boolean;
  onPress: (a: DayActivity) => void;
  onToggle?: (a: DayActivity) => void;
  /** Se llama con la posición del bloque actual (para desplazar la vista). */
  onNowLayout?: (y: number) => void;
}

export function Timeline({ activities, categoryOf, nowMinutes, canCheck, onPress, onToggle, onNowLayout }: Props) {
  return (
    <View>
      {buildTimeline(activities).map((item) => {
        const slot = item.kind === 'gap' ? item : item.activity;
        const start = toMinutes(slot.start_time);
        const end = toMinutes(slot.end_time);
        const isNow = nowMinutes != null && start <= nowMinutes && nowMinutes < end;
        const onLayout = isNow && onNowLayout ? (e: LayoutChangeEvent) => onNowLayout(e.nativeEvent.layout.y) : undefined;

        if (item.kind === 'gap') {
          return (
            <View key={`gap-${item.start_time}`} onLayout={onLayout}>
              <GapBlock gap={item} isNow={isNow} />
            </View>
          );
        }
        const a = item.activity;
        return (
          <View key={a.id} onLayout={onLayout}>
            <TimelineBlock
              activity={a}
              category={categoryOf(a.category_id)}
              isNow={isNow}
              isPast={nowMinutes != null && end <= nowMinutes}
              canCheck={canCheck}
              onPress={() => onPress(a)}
              onToggle={onToggle ? () => onToggle(a) : undefined}
            />
          </View>
        );
      })}
    </View>
  );
}
