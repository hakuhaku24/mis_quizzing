import { View, Text, StyleSheet } from "react-native";
import { formatMath } from "../lib/math";
import { colors } from "../lib/theme";

/**
 * Simplified markdown/LaTeX renderer for React Native.
 *
 * The web app renders this text with react-markdown + KaTeX, which needs a
 * DOM. Here math ($...$, $$...$$) is converted to readable Unicode text by
 * lib/math.ts (O(n log n), 2¹³, ≤, →), and **bold**, ・ bullets and ```
 * code blocks get plain RN styling. Not a typesetter, but no raw LaTeX
 * reaches the screen.
 */
export default function RichText({ children, style }: { children: string; style?: object }) {
  const blocks = splitCodeBlocks(children);
  return (
    <View style={style}>
      {blocks.map((block, i) =>
        block.type === "code" ? (
          <View key={i} style={styles.codeBlock}>
            <Text style={styles.codeText}>{block.text}</Text>
          </View>
        ) : (
          <Text key={i} style={styles.paragraph}>
            {renderInline(block.text)}
          </Text>
        )
      )}
    </View>
  );
}

function splitCodeBlocks(text: string): { type: "text" | "code"; text: string }[] {
  const parts = text.split(/```[a-z]*\n?([\s\S]*?)```/g);
  return parts
    .map((part, i) => ({ type: (i % 2 === 1 ? "code" : "text") as "text" | "code", text: part }))
    .filter((p) => p.text.trim().length > 0);
}

function renderInline(text: string) {
  // math becomes plain text first, then **bold** spans are split out
  const tokens = formatMath(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return tokens.map((t, i) => {
    if (t.startsWith("**") && t.endsWith("**")) {
      return <Text key={i} style={styles.bold}>{t.slice(2, -2)}</Text>;
    }
    return <Text key={i}>{t}</Text>;
  });
}

const styles = StyleSheet.create({
  paragraph: { fontSize: 13.5, lineHeight: 22, color: colors.ink, marginBottom: 8 },
  bold: { fontWeight: "700" },
  codeBlock: { backgroundColor: "#18181B", borderRadius: 10, padding: 12, marginVertical: 6 },
  codeText: { color: "#E4E4E7", fontFamily: "monospace", fontSize: 12.5, lineHeight: 18 },
});
