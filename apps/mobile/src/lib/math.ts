/**
 * LaTeX → readable plain text for the math in questions, options, solutions
 * and AI feedback ($...$ and $$...$$). React Native has no KaTeX, and the
 * bank's math is mostly short inline expressions — O(n \log n), 2^{13},
 * \frac{a}{b}, \le, \rightarrow — which read fine as Unicode: O(n log n),
 * 2¹³, a/b, ≤, →. Anything unrecognised degrades to its bare name rather
 * than leaking backslashes onto the screen.
 */

const SYMBOLS: Record<string, string> = {
  // operators and relations
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", ast: "*",
  le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", sim: "∼", propto: "∝",
  ll: "≪", gg: "≫",
  // arrows
  rightarrow: "→", to: "→", leftarrow: "←", gets: "←", leftrightarrow: "↔", Rightarrow: "⇒", Leftarrow: "⇐",
  Leftrightarrow: "⇔", implies: "⇒", iff: "⇔", mapsto: "↦", uparrow: "↑", downarrow: "↓",
  // sets and logic
  in: "∈", notin: "∉", subseteq: "⊆", subset: "⊂", supseteq: "⊇", supset: "⊃", nsubseteq: "⊈", cup: "∪", cap: "∩",
  emptyset: "∅", varnothing: "∅", forall: "∀", exists: "∃", neg: "¬", lnot: "¬", land: "∧", wedge: "∧", lor: "∨",
  vee: "∨", oplus: "⊕", otimes: "⊗", setminus: "∖", bowtie: "⋈",
  // big operators and misc
  sum: "Σ", prod: "Π", int: "∫", infty: "∞", partial: "∂", nabla: "∇", circ: "∘", bullet: "•", star: "⋆",
  dots: "…", ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱", Box: "□", square: "□", bigcirc: "○", triangle: "△",
  lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", langle: "⟨", rangle: "⟩", mid: "|", vert: "|", Vert: "‖",
  prime: "′", degree: "°",
  // greek
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  vartheta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ",
  tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

/** Function names typeset upright in LaTeX: keep the word. */
const WORDS = new Set(["log", "lg", "ln", "exp", "max", "min", "sup", "inf", "lim", "sin", "cos", "tan", "gcd", "det", "deg", "arg"]);

/** Wrappers whose argument is just shown as-is. */
const UNWRAP = new Set(["text", "textrm", "textbf", "textit", "mathrm", "mathbf", "mathit", "mathsf", "mathtt", "mathcal", "operatorname", "underline", "overline", "boxed", "mbox", "hat", "bar", "vec", "tilde", "widehat", "emph"]);

/** Spacing and sizing commands that just disappear (or become a space). */
const SPACES: Record<string, string> = { quad: " ", qquad: " ", space: " ", ",": " ", ";": " ", ":": " ", " ": " ", "!": "" };
const DROP = new Set(["left", "right", "big", "Big", "bigg", "Bigg", "displaystyle", "textstyle", "limits", "nolimits", "rm", "bf", "it", "nonumber"]);

const SUPER: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", h: "ʰ", k: "ᵏ", m: "ᵐ", x: "ˣ", y: "ʸ",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", j: "ʲ", l: "ˡ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ",
  u: "ᵘ", v: "ᵛ", w: "ʷ", z: "ᶻ", T: "ᵀ", "*": "*", "′": "′", "°": "°",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ",
  m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

/** Read one argument starting at i: a {group} or a single character. */
function readArg(s: string, i: number): [string, number] {
  while (s[i] === " ") i++;
  if (s[i] === "\\") {
    // an unbraced command as the argument, e.g. ^\circ
    const name = /^[A-Za-z]+/.exec(s.slice(i + 1))?.[0] ?? s[i + 1] ?? "";
    return [s.slice(i, i + 1 + name.length), i + 1 + name.length];
  }
  if (s[i] !== "{") return [s[i] ?? "", i + 1];
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return [s.slice(i + 1), s.length];
}

/** A single token (letters, digits, greek, super/subscripts) that needs no parentheses. */
const isSimple = (t: string) => /^[\w.′²³¹ʰ-˿Ͱ-Ͽᴬ-ᶿ⁰-₟ⱼ]+$/.test(t);

function script(content: string, table: Record<string, string>, mark: string): string {
  const chars = [...content.replace(/\s+/g, "")];
  if (chars.length && chars.every((c) => c in table)) return chars.map((c) => table[c]).join("");
  return isSimple(content) ? `${mark}${content}` : `${mark}(${content})`;
}

function convert(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\") {
      const name = /^[A-Za-z]+/.exec(s.slice(i + 1))?.[0];
      if (!name) {
        // escaped symbol: \% \{ \} \_ \& \# \$ \\ or spacing like \,
        const next = s[i + 1] ?? "";
        if (next in SPACES) out += SPACES[next];
        else if (next === "\\") out += "; ";
        else out += next;
        i += 2;
        continue;
      }
      i += 1 + name.length;
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const [a, i2] = readArg(s, i);
        const [b, i3] = readArg(s, i2);
        const ta = convert(a);
        const tb = convert(b);
        out += `${isSimple(ta) ? ta : `(${ta})`}/${isSimple(tb) ? tb : `(${tb})`}`;
        i = i3;
      } else if (name === "binom") {
        const [a, i2] = readArg(s, i);
        const [b, i3] = readArg(s, i2);
        out += `C(${convert(a)}, ${convert(b)})`;
        i = i3;
      } else if (name === "sqrt") {
        const [a, i2] = readArg(s, i);
        const t = convert(a);
        out += isSimple(t) ? `√${t}` : `√(${t})`;
        i = i2;
      } else if (name === "pmod") {
        const [a, i2] = readArg(s, i);
        out += ` (mod ${convert(a)})`;
        i = i2;
      } else if (name === "bmod" || name === "mod") {
        out += " mod ";
      } else if (name === "begin" || name === "end") {
        i = readArg(s, i)[1]; // environment name; rows become "; " via \\ and cells a space via &
      } else if (name === "hspace" || name === "vspace") {
        i = readArg(s, i)[1];
        out += " ";
      } else if (UNWRAP.has(name)) {
        const [a, i2] = readArg(s, i);
        out += convert(a);
        i = i2;
      } else if (name in SPACES) {
        out += SPACES[name];
      } else if (DROP.has(name)) {
        // nothing
      } else if (WORDS.has(name)) {
        // keep "log n" apart, but "log₂ n" / "log(n)" tight
        out += /[A-Za-z0-9{]/.test(s[i] ?? "") ? `${name} ` : name;
      } else if (name in SYMBOLS) {
        out += SYMBOLS[name];
      } else {
        out += name; // unknown command: show its name, never the backslash
      }
    } else if (ch === "^" || ch === "_") {
      const [arg, i2] = readArg(s, i + 1);
      const inner = convert(arg).trim();
      if (ch === "^" && (inner === "∘" || inner === "°")) out += "°";
      else out += script(inner, ch === "^" ? SUPER : SUB, ch);
      i = i2;
    } else if (ch === "{" || ch === "}") {
      i++; // bare grouping braces
    } else if (ch === "&") {
      out += " ";
      i++;
    } else if (ch === "~") {
      out += " ";
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** One math expression (without its $ delimiters) as readable text. */
export function latexToText(expr: string): string {
  return convert(expr)
    .replace(/\s+([)\]},.;:!?⌉⌋⟩])/g, "$1")
    .replace(/([([{⌈⌊⟨])\s+/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Replace every $$...$$ and $...$ in a string with readable text. An inline
 *  $...$ may span lines only when it really is LaTeX (has a \command), so two
 *  unrelated dollar signs on different lines are never paired up. */
export function formatMath(text: string): string {
  if (!text.includes("$")) return text;
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => `\n${latexToText(m)}\n`)
    .replace(/\$([^$]+?)\$/g, (whole: string, m: string) =>
      m.includes("\n") && !/\\[A-Za-z]/.test(m) ? whole : latexToText(m)
    );
}
