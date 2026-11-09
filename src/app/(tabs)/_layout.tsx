import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { colors, fonts } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );

export default function TabsLayout() {
  // En la web la altura por defecto (49) corta las etiquetas. El indicador de inicio ya lo deja libre #root (index.html).
  const webBar = Platform.OS === 'web' ? { height: 64, paddingTop: 4, paddingBottom: 4 } : null;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, ...webBar },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoy', tabBarIcon: icon('today-outline') }} />
      <Tabs.Screen name="semana" options={{ title: 'Semana', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="rutina" options={{ title: 'Rutina', tabBarIcon: icon('repeat-outline') }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
