import { z } from 'zod'

export const apiErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'BAD_REQUEST',
  'CONFLICT',
  'RATE_LIMITED',
  'UNAVAILABLE',
  'INTERNAL_ERROR',
])

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
