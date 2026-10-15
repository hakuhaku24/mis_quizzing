import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { DELETE_ACCOUNT_URL, PRIVACY_POLICY_URL } from "../lib/links";
import { colors } from "../lib/theme";

/** 隱私權政策 · 刪除帳號說明 — opened in the phone's browser. */
export function LegalLinks() {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} style={styles.link} accessibilityRole="link">
        <Text style={styles.text}>隱私權政策</Text>
      </Pressable>
      <Text style={styles.dot}>·</Text>
      <Pressable onPress={() => Linking.openURL(DELETE_ACCOUNT_URL)} style={styles.link} accessibilityRole="link">
        <Text style={styles.text}>刪除帳號說明</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4 },
  link: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  text: { fontSize: 12, color: colors.ink2, textDecorationLine: "underline" },
  dot: { fontSize: 12, color: colors.ink3 },
});
