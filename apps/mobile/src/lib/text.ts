import { formatMath } from "./math";

/** Plain-text preview for list rows: math as readable text, Markdown
 *  markup stripped (full question screens use RichText instead). */
export function stripMarkup(s: string): string {
  return formatMath(s)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
