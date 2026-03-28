import fs from 'fs'
import path from 'path'
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

/** Walk up until we find node_modules — handles git worktrees where deps live in the repo root. */
function findModulesRoot(dir: string): string {
  if (fs.existsSync(path.join(dir, 'node_modules'))) return dir
  const parent = path.dirname(dir)
  return parent === dir ? dir : findModulesRoot(parent)
}
const projectRoot = findModulesRoot(process.cwd())

const cspDirectives = [
  "default-src 'self'",
  // C5: unsafe-eval is only needed for Next.js dev hot reload — removed in production.
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  // Allow connections to Gemini (REST + WebSocket for Live API) and Anthropic APIs
  "connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://api.anthropic.com",
  "media-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // X-Frame-Options is redundant with CSP frame-ancestors — kept for legacy clients
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(self)',
  },
  {
    key: 'Content-Security-Policy',
    value: cspDirectives,
  },
]

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  // pdf-parse uses fs and Node.js internals — exclude from webpack bundling
  // to avoid "Module not found" errors in serverless API routes.
  serverExternalPackages: ['pdf-parse'],
}

export default nextConfig
