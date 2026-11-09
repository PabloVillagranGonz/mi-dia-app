// En nativo no hace nada: los márgenes del notch y del indicador de inicio los pone react-native-safe-area-context.
import type { ReactNode } from 'react';

export function WebSafeArea({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
