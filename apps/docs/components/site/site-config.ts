/**
 * Site-wide navigation and metadata. Single source of truth for Navbar, Footer and the docs sidebar.
 * Update GITHUB_URL once the public repository location is final.
 */
export const SITE_NAME = "BackendFoundry";
export const SITE_TAGLINE = "Backend infrastructure, built in blocks.";
export const GITHUB_URL = "https://github.com/nitin-inloop/Backendfoundry";
export const INSTALL_COMMAND = "npx @backendfoundry/cli add rate-limit";

export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

export const MAIN_NAV: NavLink[] = [
  { label: "Docs", href: "/docs" },
  { label: "Components", href: "/packages" },
  { label: "Playground", href: "/playground" },
  { label: "Changelog", href: "/changelog" }
];

export interface DocsNavGroup {
  title: string;
  items: { title: string; href: string; description: string }[];
}

export const DOCS_NAV: DocsNavGroup[] = [
  {
    title: "Getting started",
    items: [
      { title: "Introduction", href: "/docs", description: "What BackendFoundry is and how the pieces fit." },
      { title: "Quick start", href: "/docs/getting-started", description: "Protect your first route in five minutes." },
      { title: "Installation", href: "/docs/installation", description: "npm packages or source files via the CLI." },
      { title: "Configuration", href: "/docs/configuration", description: "Environment parsing, stores and shared options." }
    ]
  },
  {
    title: "Frameworks",
    items: [
      { title: "Express", href: "/docs/express", description: "Middleware adapters and the error handler." },
      { title: "Fastify", href: "/docs/fastify", description: "preHandler hooks and setErrorHandler." },
      { title: "Next.js", href: "/docs/nextjs", description: "Route Handlers on the Node.js runtime." }
    ]
  },
  {
    title: "Production",
    items: [
      { title: "Security", href: "/docs/security", description: "Redaction, constant-time checks and safe errors." },
      { title: "Testing", href: "/docs/testing", description: "Memory stores, mock providers and fake clocks." },
      { title: "Deployment", href: "/docs/deployment", description: "Multi-replica state, Redis and health probes." }
    ]
  },
  {
    title: "Project",
    items: [
      { title: "Contributing", href: "/docs/contributing", description: "Repository layout and the definition of done." },
      { title: "Changelog", href: "/changelog", description: "Release history." },
      { title: "License", href: "/license", description: "MIT." }
    ]
  }
];

export const DOCS_FLAT = DOCS_NAV.flatMap((g) => g.items);
