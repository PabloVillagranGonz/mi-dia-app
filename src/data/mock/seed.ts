// Datos iniciales (spec §6). Misma forma que las tablas y que supabase/migrations/0001_init.sql.

import type { Category, HHMM, TemplateActivity, Weekday } from '../types';

export const MOCK_USER_ID = 'mock-user';

export const CATEGORY_IDS = {
  trabajo: 'cat-trabajo',
  musica: 'cat-musica',
  salud: 'cat-salud',
  personal: 'cat-personal',
} as const;

export const seedCategories: Category[] = [
  { id: CATEGORY_IDS.trabajo, user_id: MOCK_USER_ID, name: 'Trabajo / estudio', color: '#4F8CFF', sort_order: 0 },
  { id: CATEGORY_IDS.musica, user_id: MOCK_USER_ID, name: 'Música', color: '#B07CFF', sort_order: 1 },
  { id: CATEGORY_IDS.salud, user_id: MOCK_USER_ID, name: 'Salud', color: '#34D399', sort_order: 2 },
  { id: CATEGORY_IDS.personal, user_id: MOCK_USER_ID, name: 'Personal', color: '#F5B544', sort_order: 3 },
];

type Row = [HHMM, HHMM, string, keyof typeof CATEGORY_IDS, 'task' | 'fixed', boolean?];

const COMMON: Row[] = [
  ['00:30', '09:00', 'Dormir', 'salud', 'fixed', false],
  ['09:00', '09:30', 'Despertar y desayuno', 'salud', 'fixed'],
  ['09:30', '10:30', 'Deporte', 'salud', 'task'],
  ['10:30', '12:30', 'Programar / proyectos', 'trabajo', 'task'],
  ['12:30', '13:30', 'Practicar instrumento', 'musica', 'task'],
  ['13:30', '14:00', 'Casa y recados', 'personal', 'task'],
  ['14:00', '16:00', 'Comida y descanso', 'salud', 'fixed'],
  ['21:30', '22:30', 'Cena', 'salud', 'fixed'],
];

const AFTERNOONS: Partial<Record<Weekday, Row[]>> = {
  1: [
    ['16:00', '18:00', 'Practicar instrumento', 'musica', 'task'],
    ['18:00', '20:00', 'Programar / proyectos', 'trabajo', 'task'],
  ],
  2: [['16:00', '20:00', 'Conservatorio', 'musica', 'task']],
  3: [
    ['16:00', '17:30', 'Practicar instrumento', 'musica', 'task'],
    ['17:30', '19:00', 'Programar / proyectos', 'trabajo', 'task'],
    ['19:30', '21:00', 'Conservatorio', 'musica', 'task'],
  ],
  4: [
    ['16:00', '18:00', 'Practicar instrumento', 'musica', 'task'],
    ['18:00', '20:00', 'Deporte / ocio', 'personal', 'task'],
  ],
  5: [['16:00', '20:00', 'Conservatorio', 'musica', 'task']],
};

function buildTemplates(): TemplateActivity[] {
  const out: TemplateActivity[] = [];
  for (const weekday of [1, 2, 3, 4, 5] as Weekday[]) {
    const rows = [...COMMON, ...(AFTERNOONS[weekday] ?? [])];
    rows.forEach(([start, end, title, cat, kind, notify = true]) => {
      out.push({
        id: `tpl-${weekday}-${start}`,
        user_id: MOCK_USER_ID,
        weekday,
        start_time: start,
        end_time: end,
        title,
        category_id: CATEGORY_IDS[cat],
        kind,
        notify,
        split_group_id: null,
      });
    });
  }
  // Sábado y domingo: vacíos.
  return out;
}

export const seedTemplates: TemplateActivity[] = buildTemplates();
