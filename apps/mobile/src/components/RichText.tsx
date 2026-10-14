import { View, Text, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

/**
 * Simplified markdown/LaTeX renderer for React Native.
 *
 * KNOWN LIMITATION (flagged, not hidden): the web app renders this text with
 * react-markdown + KaTeX (apps/web/src/components/RichText.tsx), which needs
 * a DOM and can't run in React Native. This version only strips $...$
 * delimiters and italicizes the math instead of real-rendering it, and
 * handles **bold**, ・ bullets, and ``` code blocks with plain RN styling.
 * Good enough to read; not a real KaTeX replacement. Follow-up: a
 * react-native-webview-based KaTeX component for faithful rendering —
 * not attempted tonight since there's no emulator/device here to test it on.
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
  // split on **bold** and $math$, keep both as separate styled spans
  const tokens = text.split(/(\*\*[^*]+\*\*|\$[^$]+\$)/g).filter(Boolean);
  return tokens.map((t, i) => {
    if (t.startsWith("**") && t.endsWith("**")) {
      return <Text key={i} style={styles.bold}>{t.slice(2, -2)}</Text>;
    }
    if (t.startsWith("$") && t.endsWith("$")) {
      return <Text key={i} style={styles.math}>{t.slice(1, -1)}</Text>;
    }
    return <Text key={i}>{t}</Text>;
  });
}

const styles = StyleSheet.create({
  paragraph: { fontSize: 13.5, lineHeight: 22, color: colors.ink, marginBottom: 8 },
  bold: { fontWeight: "700" },
  math: { fontStyle: "italic", fontFamily: "monospace" },
  codeBlock: { backgroundColor: "#18181B", borderRadius: 10, padding: 12, marginVertical: 6 },
  codeText: { color: "#E4E4E7", fontFamily: "monospace", fontSize: 12.5, lineHeight: 18 },
});
