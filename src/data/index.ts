// Punto de entrada de la capa de datos. Las pantallas importan de '@/data' y nada más.

import { supabase } from '@/lib/supabase';
import { withReadCache } from './cache';
import { createMockStore } from './mock/store';
import { createRepository } from './repository';
import { createSupabaseStore } from './supabase/store';

export { isOffline, onOfflineChange } from './cache';

export const usingMockData = !supabase;

export const repo = createRepository(supabase ? withReadCache(createSupabaseStore(supabase)) : createMockStore());

export type { ActivityInput, Repository, TemplateInput } from './repository';
export * from './types';
export { errorMessage, UserError } from './errors';
export * as auth from './auth';
export * as push from './push';
export * as google from './google';
export * as adminApi from './admin';
export { myFlags, NO_FLAGS } from './account';
export { subscribeRemoteChanges } from './live';
