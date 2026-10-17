/**
 * <CodeBlock> — DESIGN: code-block + code-block-header. Dark surface-code panel, Geist Mono 14px,
 * syntax highlight (.tok-* in globals.css), copy-to-clipboard.
 * Props:
 *   code: string                 source text (trailing newline trimmed)
 *   language?: CodeLanguage      "ts" | "tsx" | "js" | "json" | "bash" | "sh" | "text" (default "ts")
 *   filename?: string            shows a header bar with the file name + language
 *   showLineNumbers?: boolean    (default false)
 *   highlightLines?: number[]    1-based lines to mark with a mint gutter + tint
 *   copy?: boolean               show the copy button (default true)
 *   className?: string
 * Server-component friendly (only the copy button hydrates).
 */
import { CopyButton } from "./copy-button";
import { cn } from "./cn";
import { highlight, type CodeLanguage } from "./highlight";

export interface CodeBlockProps {
  code: string;
  language?: CodeLanguage;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  copy?: boolean;
  className?: string;
}

const LANG_LABEL: Record<CodeLanguage, string> = {
  ts: "TypeScript",
  tsx: "TSX",
  js: "JavaScript",
  json: "JSON",
  bash: "Shell",
  sh: "Shell",
  text: "Text"
};

export function CodeBlock({
  code,
  language = "ts",
  filename,
  showLineNumbers = false,
  highlightLines = [],
  copy = true,
  className
}: CodeBlockProps) {
  const source = code.replace(/\n+$/, "");
  const lines = splitTokensIntoLines(highlight(source, language));
  const marked = new Set(highlightLines);

  return (
    <div className={cn("group/code relative overflow-hidden rounded-md border border-hairline-dark bg-surface-code", className)}>
      {filename ? (
        <div className="flex items-center justify-between gap-3 border-b border-hairline-dark py-1.5 pl-4 pr-1.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="truncate font-mono text-caption text-on-dark">{filename}</span>
            <span className="hidden text-micro text-on-dark-muted/70 sm:inline">{LANG_LABEL[language]}</span>
          </span>
          {copy && <CopyButton value={source} tone="dark" label={`Copy ${filename}`} />}
        </div>
      ) : (
        copy && (
          <div className="absolute right-2 top-2 z-10 opacity-100 transition-opacity md:opacity-0 md:group-hover/code:opacity-100 md:group-focus-within/code:opacity-100">
            <CopyButton value={source} tone="dark" className="bg-surface-code/90 backdrop-blur" />
          </div>
        )
      )}
      <pre className="overflow-x-auto py-4 font-mono text-[13.5px] leading-[1.65] text-[#e8e8ea]" tabIndex={0}>
        <code className="block min-w-max">
          {lines.map((line, i) => {
            const n = i + 1;
            const isMarked = marked.has(n);
            return (
              <span
                key={i}
                className={cn(
                  "block border-l-2 pl-[14px] pr-12",
                  isMarked ? "border-brand-green bg-brand-green/[0.09]" : "border-transparent"
                )}
              >
                {showLineNumbers && (
                  <span aria-hidden="true" className="mr-5 inline-block w-5 select-none text-right text-[#5c5c62]">
                    {n}
                  </span>
                )}
                {line.length === 0
                  ? "​"
                  : line.map((t, j) =>
                      t.cls ? (
                        <span key={j} className={t.cls}>
                          {t.text}
                        </span>
                      ) : (
                        <span key={j}>{t.text}</span>
                      )
                    )}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

function splitTokensIntoLines(tokens: ReturnType<typeof highlight>) {
  const lines: ReturnType<typeof highlight>[] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ text: part, cls: token.cls });
    });
  }
  return lines;
}
