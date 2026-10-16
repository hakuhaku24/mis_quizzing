import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";

// A stack (not a Slot) so the tabs stay mounted underneath a pushed question:
// going back returns to the tab you came from (題庫, 紀錄…) instead of 首頁.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
