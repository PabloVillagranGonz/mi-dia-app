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

import { useEnsureCurrentWeek } from '@/hooks/useEnsureCurrentWeek';
import { useSession } from '@/hooks/useSession';
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

  if (!fontsLoaded || session === undefined) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <>
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
        </Stack.Protected>
        <Stack.Protected guard={!loggedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
