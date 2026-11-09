// Progreso: solo cuentan las tareas; las fijas no (spec §2).

import type { DayActivity } from '@/data/types';

export interface Progress {
  done: number;
  total: number;
  /** 0–1. Si no hay tareas, 0. */
  ratio: number;
}

export function progressOf(activities: ReadonlyArray<Pick<DayActivity, 'kind' | 'done'>>): Progress {
  const tasks = activities.filter((a) => a.kind === 'task');
  const done = tasks.filter((a) => a.done).length;
  return { done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0 };
}

/** «3 de 8 tareas hechas» / «Sin tareas hoy» */
export function progressLabel(p: Progress): string {
  if (p.total === 0) return 'Sin tareas hoy';
  return `${p.done} de ${p.total} ${p.total === 1 ? 'tarea hecha' : 'tareas hechas'}`;
}
