import type { Config } from "tailwindcss";

/**
 * BackendFoundry design tokens — a port of DESIGN-mintlify.md.
 *
 * Colors are named exactly after the design.md color keys, so classes read like the spec:
 *   bg-canvas text-ink border-hairline bg-surface-code text-steel bg-brand-green ...
 * Light canvas, black pill CTAs, mint (brand-green) for accents / active states only.
 *
 * Type scale (fontSize keys mirror design.md typography tokens):
 *   text-hero-display (72) text-display-lg (56) text-heading-1 (48) text-heading-2 (36)
 *   text-heading-3 (28) text-heading-4 (22) text-heading-5 (18) text-subtitle (18)
 *   text-body-md (16) text-body-sm (14) text-caption (13) text-micro (12) text-micro-upper (11)
 *   text-code-md (14) text-code-sm (13)
 * Radius: xs 4, sm 6, md 8, lg 12, xl 16, 2xl 24 (+ full).
 * Shadows: shadow-subtle, shadow-card, shadow-mockup, shadow-brand.
 * Dark mode: `class` strategy. Themed tokens (canvas, surface*, hairline, hairline-soft, ink, charcoal, slate,
 * steel, stone, muted, primary, on-primary) read CSS variables set in globals.css and flip under `.dark`;
 * brand, hero, *-dark, on-dark* and surface-code are fixed in both themes.
 * The default Tailwind palette is kept (extend) so utility colors like white/black still work.
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx,mdx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--c-primary) / <alpha-value>)",
        "on-primary": "rgb(var(--c-on-primary) / <alpha-value>)",
        "brand-green": "#00d4a4",
        "brand-green-deep": "#00b48a",
        "brand-green-soft": "#7cebcb",
        "brand-tag": "#3772cf",
        "brand-warn": "#c37d0d",
        "brand-annotate": "#1ba673",
        "brand-error": "#d45656",
        "hero-sky-from": "#87a8c8",
        "hero-sky-to": "#f5e9d8",
        "hero-dark-from": "#1a3d4a",
        "hero-dark-to": "#2d5a4f",
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        "canvas-dark": "#0a0a0a",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-soft": "rgb(var(--c-surface-soft) / <alpha-value>)",
        "surface-code": "#1c1c1e",
        hairline: "rgb(var(--c-hairline) / <alpha-value>)",
        "hairline-soft": "rgb(var(--c-hairline-soft) / <alpha-value>)",
        "hairline-dark": "#1f1f1f",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        charcoal: "rgb(var(--c-charcoal) / <alpha-value>)",
        slate: "rgb(var(--c-slate) / <alpha-value>)",
        steel: "rgb(var(--c-steel) / <alpha-value>)",
        stone: "rgb(var(--c-stone) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        "on-dark": "#ffffff",
        "on-dark-muted": "#b3b3b3"
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        mono: ['"Geist Mono Variable"', '"Geist Mono"', '"SF Mono"', "Menlo", "Consolas", "monospace"]
      },
      fontSize: {
        "hero-display": ["72px", { lineHeight: "1.05", letterSpacing: "-2px", fontWeight: "600" }],
        "display-lg": ["56px", { lineHeight: "1.1", letterSpacing: "-1.5px", fontWeight: "600" }],
        "heading-1": ["48px", { lineHeight: "1.1", letterSpacing: "-1px", fontWeight: "600" }],
        "heading-2": ["36px", { lineHeight: "1.2", letterSpacing: "-0.5px", fontWeight: "600" }],
        "heading-3": ["28px", { lineHeight: "1.25", letterSpacing: "-0.3px", fontWeight: "600" }],
        "heading-4": ["22px", { lineHeight: "1.3", letterSpacing: "-0.2px", fontWeight: "600" }],
        "heading-5": ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        subtitle: ["18px", { lineHeight: "1.5" }],
        "body-md": ["16px", { lineHeight: "1.5" }],
        "body-sm": ["14px", { lineHeight: "1.5" }],
        caption: ["13px", { lineHeight: "1.4" }],
        micro: ["12px", { lineHeight: "1.4" }],
        "micro-upper": ["11px", { lineHeight: "1.4", letterSpacing: "0.5px", fontWeight: "600" }],
        "code-md": ["14px", { lineHeight: "1.6" }],
        "code-sm": ["13px", { lineHeight: "1.5" }]
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px"
      },
      maxWidth: {
        container: "1280px",
        prose: "720px"
      },
      boxShadow: {
        subtle: "rgba(0, 0, 0, 0.04) 0px 1px 2px 0px",
        card: "rgba(0, 0, 0, 0.08) 0px 4px 12px 0px",
        mockup: "rgba(0, 0, 0, 0.12) 0px 24px 48px -8px",
        brand: "rgba(0, 212, 164, 0.08) 0px 8px 24px"
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.22, 1, 0.36, 1)"
      },
      keyframes: {
        "drift-a": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(4%, -3%, 0) scale(1.06)" }
        },
        "drift-b": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1.04)" },
          "50%": { transform: "translate3d(-5%, 2%, 0) scale(1)" }
        },
        blink: { "0%, 49%": { opacity: "1" }, "50%, 100%": { opacity: "0" } },
        "ken-burns": {
          "0%": { transform: "scale(1.04) translate3d(0,0,0)" },
          "100%": { transform: "scale(1.14) translate3d(-1.5%, -2%, 0)" }
        },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } }
      },
      animation: {
        "drift-a": "drift-a 28s ease-in-out infinite",
        "drift-b": "drift-b 36s ease-in-out infinite",
        blink: "blink 1.1s steps(1) infinite",
        "ken-burns": "ken-burns 32s ease-in-out infinite alternate"
      }
    }
  },
  plugins: []
};

export default config;
