/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The repo-root .eslintrc.cjs targets plain JS packages and cannot parse TSX; linting runs via scripts/lint-check.mjs.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    "@backendfoundry/core",
    "@backendfoundry/validation",
    "@backendfoundry/rate-limit",
    "@backendfoundry/retry",
    "@backendfoundry/circuit-breaker",
    "@backendfoundry/cache",
    "@backendfoundry/idempotency",
    "@backendfoundry/webhooks",
    "@backendfoundry/health",
    "@backendfoundry/errors",
    "@backendfoundry/logger",
    "@backendfoundry/ai"
  ]
};

export default nextConfig;
