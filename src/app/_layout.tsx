import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { WebSafeArea } from '@/components/WebSafeArea';
import { useEnsureCurrentWeek } from '@/hooks/useEnsureCurrentWeek';
import { useRemoteChanges } from '@/hooks/useRemoteChanges';
import { useSession } from '@/hooks/useSession';
import { useNotifications } from '@/notifications';
import { colors } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const session = useSession();
  const loggedIn = !!session;
  useEnsureCurrentWeek(loggedIn);
  useRemoteChanges(loggedIn);
  useNotifications(loggedIn && fontsLoaded);

  if (!fontsLoaded || session === undefined) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <WebSafeArea>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Protected guard={loggedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="planificar" options={{ presentation: 'modal' }} />
          <Stack.Screen name="categorias" />
          <Stack.Screen name="dia/[date]" />
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="admin/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!loggedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </WebSafeArea>
  );
}
