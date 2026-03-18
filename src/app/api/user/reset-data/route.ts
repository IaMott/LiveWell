/**
 * DELETE /api/user/reset-data
 *
 * Cancels all user-generated data for testing purposes.
 * The user account (User record, email, password) is preserved.
 *
 * Deleted:
 *   - BodyMetricEntry (weight history)
 *   - Meal (nutrition log)
 *   - WorkoutSession (training sessions)
 *   - WorkoutPlan
 *   - MindfulnessEntry (mood/stress log)
 *   - UserAttribute (all agent-collected attributes)
 *   - RecommendationArtifact (AI recommendations)
 *   - AgentWorkspace (conversation state)
 *   - Notification
 *   - Message → Conversation (cascaded)
 *
 * Reset (not deleted):
 *   - UserProfile fields: weight, height, gender, birthDate, health, nutrition, training, mindfulness
 */

import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'
import { checkRateLimit, getClientIp } from '@/lib/security/httpGuards'
import { Prisma } from '@prisma/client'

export async function DELETE(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  const rate = checkRateLimit({ key: `reset-data:${userId}:${getClientIp(request)}`, max: 5 })
  if (!rate.ok) return errorResponse(429, 'RATE_LIMITED', 'Too many requests')

  // S3: Execute all deletes inside a transaction so a partial failure leaves data consistent.
  // Conversations must come last to avoid FK constraint issues with Messages (cascade-deleted).
  // C3: Delete ALL user data tables including the 7 that were previously missing.
  const [
    bodyMetrics,
    meals,
    workoutSessions,
    workoutPlans,
    mindfulness,
    attributes,
    artifacts,
    workspaces,
    notifications,
    conversationSummaries,
    toolAuditLogs,
    fileAssets,
    conversations,
  ] = await prisma.$transaction([
    prisma.bodyMetricEntry.deleteMany({ where: { userId } }),
    prisma.meal.deleteMany({ where: { createdByUserId: userId } }),
    prisma.workoutSession.deleteMany({ where: { userId } }),
    prisma.workoutPlan.deleteMany({ where: { userId } }),
    prisma.mindfulnessEntry.deleteMany({ where: { userId } }),
    prisma.userAttribute.deleteMany({ where: { userId } }),
    prisma.recommendationArtifact.deleteMany({ where: { userId } }),
    prisma.agentWorkspace.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    // C3: Previously missing tables — privacy/GDPR compliance
    prisma.conversationSummary.deleteMany({ where: { userId } }),
    prisma.toolAuditLog.deleteMany({ where: { userId } }),
    prisma.fileAsset.deleteMany({ where: { userId } }),
    // Messages are cascade-deleted when conversations are deleted
    prisma.conversation.deleteMany({ where: { userId } }),
  ])

  // Reset UserProfile fields (keep the record, just null the dynamic fields)
  try {
    await prisma.userProfile.update({
      where: { userId },
      data: {
        weight: null,
        height: null,
        gender: null,
        birthDate: null,
        health: Prisma.JsonNull,
        nutrition: Prisma.JsonNull,
        training: Prisma.JsonNull,
        mindfulness: Prisma.JsonNull,
        goals: Prisma.JsonNull,
      },
    })
  } catch {
    // UserProfile may not exist — that's fine
  }

  return Response.json({
    ok: true,
    deleted: {
      bodyMetrics: bodyMetrics.count,
      meals: meals.count,
      workoutSessions: workoutSessions.count,
      workoutPlans: workoutPlans.count,
      mindfulness: mindfulness.count,
      attributes: attributes.count,
      artifacts: artifacts.count,
      workspaces: workspaces.count,
      notifications: notifications.count,
      conversationSummaries: conversationSummaries.count,
      toolAuditLogs: toolAuditLogs.count,
      fileAssets: fileAssets.count,
      conversations: conversations.count,
    },
  })
}
