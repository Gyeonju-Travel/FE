import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppAlertHost } from '@/components/ui/AppAlert';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="signup-complete" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <AppAlertHost />
    </>
  );
}
