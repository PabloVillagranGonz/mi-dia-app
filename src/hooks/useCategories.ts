import { useMemo } from 'react';

import { repo, type Category } from '@/data';
import { useRepoQuery } from './useRepoQuery';

/** Categorías + búsqueda por id. */
export function useCategories() {
  const q = useRepoQuery(() => repo.getCategories(), 'categories');
  const categories = useMemo(() => q.data ?? [], [q.data]);
  const map = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const categoryOf = (id: string | null): Category | undefined => (id ? map.get(id) : undefined);
  return { categories, categoryOf, refresh: q.refresh };
}
