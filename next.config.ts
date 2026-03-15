import type { NextConfig } from 'next'

const cspDirectives = [
  "default-src 'self'",
  // Next.js requires unsafe-inline for styles and eval for dev hot reload
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
