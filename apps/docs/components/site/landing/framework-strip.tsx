/**
 * <FrameworkStrip> — DESIGN: logo-wall-item. Monochrome wordmarks of the runtimes the adapters target.
 * Marks are simple geometric glyphs (not official logos) paired with the framework name.
 */
import Link from "next/link";

const ITEMS = [
  {
    name: "Express",
    href: "/docs/express",
    glyph: <text x="2" y="17" fontSize="15" fontWeight="600" fontFamily="Inter, sans-serif" fill="currentColor">ex</text>
  },
  {
    name: "Fastify",
    href: "/docs/fastify",
    glyph: <path d="M4 18 11 4h9l-4 6h4L9 20l3-6H7z" fill="currentColor" />
  },
  {
    name: "Next.js",
    href: "/docs/nextjs",
    glyph: (
      <>
        <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M9 8v8M9 8l7 9.5M15 8v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </>
    )
  },
  {
    name: "Node.js",
    href: "/docs/installation",
    glyph: <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
  },
  {
    name: "TypeScript",
    href: "/docs/installation#tsconfig",
    glyph: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <text x="7.2" y="17" fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif" fill="currentColor">TS</text>
      </>
    )
  }
];

export function FrameworkStrip() {
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-caption text-steel">Adapters for the stack you already run</p>
      <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12">
        {ITEMS.map((item) => (
          <li key={item.name}>
            <Link
              href={item.href}
              className="group flex items-center gap-2 rounded-sm px-1 py-1 text-steel transition-colors hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-px" aria-hidden="true">
                {item.glyph}
              </svg>
              <span className="text-body-md font-medium">{item.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
