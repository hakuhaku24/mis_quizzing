/**
 * Multiple-choice answers are stored as a comma-separated set of letters:
 * "C" for single-select, "A,C,D" for multi-select (questions.correct_option
 * and user_attempts.selected_option alike). Multi-select is all-or-nothing.
 */

export function parseChoice(value: string | null | undefined): string[] {
  if (!value) return [];
  const letters = value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]$/.test(s));
  return [...new Set(letters)].sort();
}

export function formatChoice(letters: string[]): string {
  return [...new Set(letters)].sort().join(",");
}

export function toggleChoice(value: string, letter: string): string {
  const current = parseChoice(value);
  return formatChoice(current.includes(letter) ? current.filter((l) => l !== letter) : [...current, letter]);
}

export function sameChoice(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = parseChoice(a);
  const y = parseChoice(b);
  return x.length > 0 && x.length === y.length && x.every((l, i) => l === y[i]);
}

/** "A、C、D" for display. */
export function choiceLabel(value: string | null | undefined): string {
  return parseChoice(value).join("、");
}

export function isMultiSelect(q: { is_multi_select?: boolean | null; correct_option: string | null }): boolean {
  return q.is_multi_select === true || parseChoice(q.correct_option).length > 1;
}
