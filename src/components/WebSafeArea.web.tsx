// En la web (app añadida a la pantalla de inicio del iPhone) los márgenes del notch y del
// indicador de inicio los pone el CSS de #root con env(safe-area-inset-*) (public/index.html).
// La medición de react-native-safe-area-context en Safari no es fiable (daba 0 arriba), así que
// aquí se anulan sus insets para no sumarlos dos veces.
import type { ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const ZERO = { top: 0, bottom: 0, left: 0, right: 0 };

export function WebSafeArea({ children }: { children: ReactNode }) {
  return <SafeAreaInsetsContext.Provider value={ZERO}>{children}</SafeAreaInsetsContext.Provider>;
}
