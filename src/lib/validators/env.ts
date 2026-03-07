import { z } from 'zod'

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  LIVE_MODEL: z.string().min(1).default('gemini-2.0-flash-live'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cachedEnv: ServerEnv | null = null

export function parseServerEnv(raw: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid server env: ${parsed.error.issues.map((issue) => issue.path.join('.') + ':' + issue.message).join(', ')}`)
  }

  const env = parsed.data
  if (env.NODE_ENV === 'production') {
    if (!env.GEMINI_API_KEY) {
      throw new Error('Missing GEMINI_API_KEY in production')
    }
    if (!env.NEXTAUTH_SECRET) {
      throw new Error('Missing NEXTAUTH_SECRET in production')
    }
  }

  return env
}

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = parseServerEnv(process.env)
  }
  return cachedEnv
}

export function resetServerEnvForTests(): void {
  cachedEnv = null
}
