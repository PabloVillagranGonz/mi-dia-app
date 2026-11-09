// Versión web de Alert.alert con los diálogos del navegador.
// Todos los diálogos de la app tienen como mucho dos botones: uno «cancel» y una acción.

import type { AlertButton } from 'react-native';

function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  const cancel = (buttons ?? []).find((b) => b.style === 'cancel');

  if (actions.length === 0) {
    window.alert(text);
    cancel?.onPress?.();
    return;
  }
  // Aceptar → primera acción; Cancelar → botón «cancel».
  if (window.confirm(text)) actions[0].onPress?.();
  else cancel?.onPress?.();
}

export const Alert = { alert };
