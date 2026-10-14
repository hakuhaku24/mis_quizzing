import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSession } from "../../lib/useSession";
import { colors } from "../../lib/theme";

export default function TabsLayout() {
  const session = useSession();

  if (session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ground }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: { borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "首頁", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="practice"
        options={{ title: "練習", tabBarIcon: ({ color, size }) => <Ionicons name="create-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="bank"
        options={{ title: "題庫", tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ title: "分析", tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "紀錄", tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
