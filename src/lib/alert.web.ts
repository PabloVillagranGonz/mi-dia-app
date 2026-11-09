// Versión web de Alert.alert: diálogo propio de la app (src/components/DialogHost.tsx),
// con los mismos botones que en nativo, en vez de window.alert / window.confirm.

import type { AlertButton } from 'react-native';

import { showDialog } from './dialog';

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    showDialog(title, message, buttons);
  },
};
