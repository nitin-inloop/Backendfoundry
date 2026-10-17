/**
 * highlight(code, language) — a small, dependency-free syntax tokenizer.
 * Returns an array of { text, cls } tokens; cls maps to .tok-* classes in globals.css.
 * Supported languages: "ts" | "tsx" | "js" | "json" | "bash" | "sh" | "text".
 * Deliberately conservative: unknown input is emitted as plain text.
 */
export type CodeLanguage = "ts" | "tsx" | "js" | "json" | "bash" | "sh" | "text";

export interface CodeToken {
  text: string;
  cls?: "tok-k" | "tok-s" | "tok-c" | "tok-n" | "tok-f" | "tok-p";
}

const TS_KEYWORDS = new Set([
  "import", "from", "export", "default", "const", "let", "var", "function", "return", "async", "await",
  "if", "else", "try", "catch", "finally", "throw", "new", "class", "extends", "type", "interface",
  "as", "typeof", "of", "in", "for", "while", "true", "false", "null", "undefined", "void", "this", "satisfies"
]);

const TS_PATTERN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|([{}()[\];,.:=<>?!&|+\-*/%]+)/g;

const SH_PATTERN = /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'[^'\n]*')|(\s--?[\w-]+)|(^|\n)(\s*)(npx|pnpm|npm|yarn|node|bun|curl|git|cd)\b/g;

export function highlight(code: string, language: CodeLanguage = "ts"): CodeToken[] {
  if (language === "text") return [{ text: code }];
  if (language === "bash" || language === "sh") return highlightShell(code);

  const tokens: CodeToken[] = [];
  let last = 0;
  TS_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TS_PATTERN.exec(code)) !== null) {
    if (m.index > last) tokens.push({ text: code.slice(last, m.index) });
    const [full, comment, str, num, fnName, ident, punct] = m;
    if (comment) tokens.push({ text: full, cls: "tok-c" });
    else if (str) tokens.push({ text: full, cls: "tok-s" });
    else if (num) tokens.push({ text: full, cls: "tok-n" });
    else if (fnName) tokens.push({ text: full, cls: TS_KEYWORDS.has(fnName) ? "tok-k" : "tok-f" });
    else if (ident) tokens.push(TS_KEYWORDS.has(ident) ? { text: full, cls: "tok-k" } : { text: full });
    else if (punct) tokens.push({ text: full, cls: "tok-p" });
    else tokens.push({ text: full });
    last = m.index + full.length;
  }
  if (last < code.length) tokens.push({ text: code.slice(last) });
  return tokens;
}

function highlightShell(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let last = 0;
  SH_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SH_PATTERN.exec(code)) !== null) {
    if (m.index > last) tokens.push({ text: code.slice(last, m.index) });
    const [full, comment, str, flag, nl, indent, cmd] = m;
    if (comment) tokens.push({ text: full, cls: "tok-c" });
    else if (str) tokens.push({ text: full, cls: "tok-s" });
    else if (flag) tokens.push({ text: full, cls: "tok-p" });
    else if (cmd) {
      tokens.push({ text: (nl ?? "") + (indent ?? "") });
      tokens.push({ text: cmd, cls: "tok-k" });
    } else tokens.push({ text: full });
    last = m.index + full.length;
  }
  if (last < code.length) tokens.push({ text: code.slice(last) });
  return tokens;
}
