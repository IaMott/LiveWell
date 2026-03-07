import { z } from 'zod'

export const DomainSchema = z.enum([
  'general',
  'nutrition',
  'health',
  'training',
  'mindfulness',
  'inspiration',
  'coordination',
])

export const AgentProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  domainTags: z.array(DomainSchema).min(1),
  systemPromptPath: z.string().min(1), // relative to agent folder
  toolsAllowed: z.array(z.string()).default([]),
  escalationRules: z.array(z.string()).optional(),
  disclaimerStyle: z.enum(['concise', 'standard', 'strict']).optional(),
  decisionStyle: z.literal('team-led'),
})

export type AgentProfileFile = z.infer<typeof AgentProfileSchema>
