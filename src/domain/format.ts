import type { Slot } from './intervals';

/** «14:00–15:00» */
export function formatDurationRange(s: Slot): string {
  return `${s.start_time}–${s.end_time}`;
}
