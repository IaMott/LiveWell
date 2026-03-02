import { z } from 'zod'

const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url().optional(),

  // Auth
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  // AI
  GEMINI_API_KEY: z.string().min(1).optional(),
  AI_PROVIDER: z.enum(['gemini', 'mock']).default('mock'),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('LiveWell'),

  // Storage (optional)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Web Push (optional)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_EMAIL: z.string().email().optional(),

  // Feature flags
  ENABLE_LIVE_AUDIO: z.string().default('false'),
  ENABLE_SMS: z.string().default('false'),
})

export type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.format()
    console.error('❌ Invalid environment variables:', JSON.stringify(formatted, null, 2))
    // In production, throw; in dev, warn and continue with defaults
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment variables')
    }
  }
  return result.data ?? (process.env as unknown as Env)
}

export const env = parseEnv()
