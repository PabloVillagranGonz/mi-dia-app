// Cola de diálogos de la app (versión web). La pinta <DialogHost/>; la alimenta src/lib/alert.web.ts.
// Así los avisos y confirmaciones salen con el estilo de Mi Día y no con los del navegador.

import type { AlertButton } from 'react-native';

export interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showDialog(title: string, message?: string, buttons?: AlertButton[]): void {
  queue = [...queue, { id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: 'Aceptar' }] }];
  emit();
}

/** Cierra el diálogo visible y ejecuta el botón elegido (si lo hay). */
export function closeDialog(id: number, button?: AlertButton): void {
  queue = queue.filter((d) => d.id !== id);
  emit();
  button?.onPress?.();
}

export function currentDialog(): DialogRequest | null {
  return queue[0] ?? null;
}

export function subscribeDialogs(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
