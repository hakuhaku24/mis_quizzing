/** Plain-text preview for list rows: strip LaTeX/Markdown markup cheaply.
 *  Ported from apps/web/src/lib/text.ts — list rows there use the same
 *  truncated-preview pattern (full question screens use RichText instead). */
export function stripMarkup(s: string): string {
  return s
    .replace(/\$\\rm\s*([^$]*)\$/g, "$1")
    .replace(/\$([^$]{0,40}?)\$/g, (_, inner: string) =>
      inner
        .replace(/\\%/g, "%")
        .replace(/\\(?:space|,|;)/g, " ")
        .replace(/\\[a-zA-Z]+/g, "")
        .replace(/[{}]/g, "")
    )
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
