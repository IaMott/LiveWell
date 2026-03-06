import type { Role, ToolCall, ToolResult } from '@/lib/ai/runtime-types'
import { getToolDefinition, type ToolName } from './toolRegistry'
import { authorizeToolExecution } from './rbac'
import { consumeConfirmToken, issueConfirmToken } from './confirmTokenService'

export type ToolCallSource =
  | 'assistant'
  | 'user-confirmed'
  | 'file-upload'
  | 'external-link'
  | 'web-content'

export type MutationAuditEvent = {
  actorUserId: string
  conversationId: string
  toolCallId: string
  toolName: ToolName
  inputSummary: string
  inputHash: string
  status: 'success' | 'failure'
  requestId: string
  errorCode?: string
}

export type ToolExecutionContext = {
  requestId: string
  conversationId: string
  actor: {
    userId: string
    role: Role
    ownerModeEnabled: boolean
  }
  source: ToolCallSource
  confirmedByUser: boolean
}

export type ToolExecutionHandler = (
  args: unknown,
  context: ToolExecutionContext,
) => Promise<unknown>

export type ToolExecutorDeps = {
  handlers: Partial<Record<ToolName, ToolExecutionHandler>>
  writeAuditLog: (event: MutationAuditEvent) => Promise<void>
}

function summarizeInput(args: unknown): string {
  const raw = JSON.stringify(args)
  return raw.length <= 500 ? raw : `${raw.slice(0, 500)}...`
}

function hashInput(args: unknown): string {
  const stable = JSON.stringify(args)
  let hash = 0
  for (let i = 0; i < stable.length; i += 1) {
    hash = (hash * 31 + stable.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

export function shouldBlockByPromptInjectionGuard(input: {
  source: ToolCallSource
  destructive: boolean
}): boolean {
  if (!input.destructive) return false
  return (
    input.source === 'file-upload' ||
    input.source === 'external-link' ||
    input.source === 'web-content'
  )
}

export function createToolExecutor(deps: ToolExecutorDeps) {
  return {
    async executeToolCall(
      call: ToolCall,
      context: ToolExecutionContext & { confirmToken?: string },
    ): Promise<ToolResult> {
      const definition = getToolDefinition(call.name)
      if (!definition) {
        return {
          toolCallId: call.id,
          ok: false,
          error: { code: 'TOOL_NOT_ALLOWED', message: 'Tool not allowlisted' },
        }
      }

      const parsed = definition.schema.safeParse(call.args)
      if (!parsed.success) {
        return {
          toolCallId: call.id,
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid tool args',
          },
        }
      }

      const auth = authorizeToolExecution({
        role: context.actor.role,
        toolName: definition.name,
        destructive: definition.destructive,
        requiresOwnerMode: definition.requiresOwnerMode,
        ownerModeEnabled: context.actor.ownerModeEnabled,
      })
      if (!auth.ok) {
        return {
          toolCallId: call.id,
          ok: false,
          error: { code: auth.code, message: auth.reason },
        }
      }

      if (
        shouldBlockByPromptInjectionGuard({
          source: context.source,
          destructive: definition.destructive,
        })
      ) {
        return {
          toolCallId: call.id,
          ok: false,
          error: {
            code: 'PROMPT_INJECTION_BLOCKED',
            message: 'Destructive tools cannot be triggered from untrusted file/web content',
          },
        }
      }

      if (definition.destructive) {
        if (!context.confirmedByUser) {
          const token = await issueConfirmToken({
            userId: context.actor.userId,
            toolName: definition.name,
            payload: parsed.data,
          })
          return {
            toolCallId: call.id,
            ok: false,
            requiresUserConfirmation: true,
            confirmToken: token.confirmToken,
            error: {
              code: 'CONFIRMATION_REQUIRED',
              message: 'Confirm token required to execute destructive tool',
            },
          }
        }

        const providedToken = context.confirmToken
        if (!providedToken) {
          return {
            toolCallId: call.id,
            ok: false,
            error: { code: 'CONFIRMATION_REQUIRED', message: 'Missing confirm token' },
          }
        }

        const consumed = await consumeConfirmToken({
          confirmToken: providedToken,
          userId: context.actor.userId,
          toolName: definition.name,
          payload: parsed.data,
        })

        if (!consumed.ok) {
          return {
            toolCallId: call.id,
            ok: false,
            error: { code: 'INVALID_CONFIRM_TOKEN', message: consumed.reason },
          }
        }
      }

      const handler = deps.handlers[definition.name]
      if (!handler) {
        return {
          toolCallId: call.id,
          ok: false,
          error: {
            code: 'HANDLER_MISSING',
            message: `No handler registered for ${definition.name}`,
          },
        }
      }

      const inputSummary = summarizeInput(parsed.data)
      const inputHash = hashInput(parsed.data)

      try {
        const data = await handler(parsed.data, context)

        if (definition.mutation) {
          await deps.writeAuditLog({
            actorUserId: context.actor.userId,
            conversationId: context.conversationId,
            toolCallId: call.id,
            toolName: definition.name,
            inputSummary,
            inputHash,
            status: 'success',
            requestId: context.requestId,
          })
        }

        return {
          toolCallId: call.id,
          ok: true,
          data,
        }
      } catch (error) {
        if (definition.mutation) {
          await deps.writeAuditLog({
            actorUserId: context.actor.userId,
            conversationId: context.conversationId,
            toolCallId: call.id,
            toolName: definition.name,
            inputSummary,
            inputHash,
            status: 'failure',
            requestId: context.requestId,
            errorCode: 'TOOL_EXECUTION_ERROR',
          })
        }

        return {
          toolCallId: call.id,
          ok: false,
          error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Tool execution failed',
          },
        }
      }
    },
  }
}
