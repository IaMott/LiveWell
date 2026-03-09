export type Domain =
  | "general"
  | "nutrition"
  | "health"
  | "training"
  | "mindfulness"
  | "inspiration"
  | "coordination";

export type Role = "OWNER" | "ADMIN" | "USER";

export type AgentId = string;

export type ToolCall = {
  id: string;
  name: string;
  args: unknown;
};

export type ToolResult = {
  toolCallId: string;
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  confirmToken?: string;
  requiresUserConfirmation?: boolean;
  uiEvent?: { title: string; description?: string; domain?: Domain };
};

export type AgentProfile = {
  id: AgentId;
  displayName: string;
  domainTags: Domain[];
  systemPrompt: string;
  toolsAllowed: string[];
  escalationRules?: string[];
  disclaimerStyle?: "concise" | "standard" | "strict";
  decisionStyle: "team-led";
};

export type AgentInput = {
  requestId: string;
  userId: string;
  conversationId: string;
  message: string;
  domainHint?: Domain;
  contextPack: ContextPack;
  // When set, the named specialist responds in first person (direct mode)
  activeSpecialistId?: string;
  constraints?: {
    locale?: string;
    timezone?: string;
    userPreferences?: Record<string, unknown>;
    practicalConstraints?: Record<string, unknown>;
  };
};

export type AgentProposal = {
  agentId: AgentId;
  domain: Domain;
  summary: string;
  reasoning: string;
  questions?: string[];
  recommendations?: Array<{
    title: string;
    steps: string[];
    rationale: string;
    safetyNotes?: string[];
    artifactsToSave?: Array<{
      type: "nutrition" | "training" | "mindfulness" | "other";
      title: string;
      contentMarkdown: string;
      relatedResourceIds?: Record<string, string>;
    }>;
  }>;
  toolCalls?: ToolCall[];
  confidence?: number;
  citations?: Array<{ title: string; url?: string; note?: string }>;
  flags?: {
    needsMoreInfo?: boolean;
    potentialRisk?: boolean;
    urgentEscalation?: boolean;
  };
};

export type ContextPack = {
  user: {
    id: string;
    role: Role;
    profile?: Record<string, unknown>;
  };
  history: {
    recentMessages: Array<{ role: "user" | "assistant"; content: string; createdAt: string }>;
    recentArtifacts: Array<{ type: string; title: string; createdAt: string; contentMarkdown?: string }>;
  };
  trackers: {
    health?: Record<string, unknown>;
    nutrition?: Record<string, unknown>;
    training?: Record<string, unknown>;
    mindfulness?: Record<string, unknown>;
  };
  notifications: {
    unreadCount: number;
    lastSentAt?: string;
  };
  files?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    extractedText?: string;
    url?: string;
  }>;
  ui: {
    moodScore: number; // 0..100
    sectionScores?: Partial<Record<Domain, number>>;
  };
  // Geo: present ONLY if geoPreference.enabled === true (privacy-first)
  geo?: {
    country: string | null;
    region: string | null;
    city: string | null;
    timezone: string | null;
    accuracy: string | null;
  };
};

export type ActiveSpecialist = {
  id: string;
  displayName: string;
  domain: Domain;
};

export type ConsensusResult = {
  domain: Domain;
  finalMessageMarkdown: string;
  toolCallsToExecute: ToolCall[];
  ui: {
    domainIcon: Domain;
    moodScore: number;
    sectionScores?: Partial<Record<Domain, number>>;
  };
  gatingQuestions?: string[];
  safety: {
    disclaimers?: string[];
    escalation?: "none" | "recommend-professional" | "urgent";
  };
  artifactsToSave?: Array<{
    type: "nutrition" | "training" | "mindfulness" | "other";
    title: string;
    contentMarkdown: string;
  }>;
  // Set when the orchestrator detected a direct specialist request
  activeSpecialist?: ActiveSpecialist;
  debug?: {
    selectedAgents: AgentId[];
    conflicts: string[];
  };
};


// ─── Backward-compatibility types for legacy modules ─────────────────────────
export type AIMessage = { role: 'user' | 'assistant' | 'system'; content: string }
export type ProfileData = Record<string, unknown>
export type SpecialistId = string
export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3'

export type RoutingDecision = {
  primarySpecialist: SpecialistId
  supportSpecialists: SpecialistId[]
  domain: Domain
  riskLevel: RiskLevel
  requiresIntervention: boolean
}

export type AIResponse = {
  content: string
  specialist: SpecialistId
  domain: Domain
  routing: RoutingDecision
  suggestions?: string[]
  flags?: {
    potentialRisk?: boolean
    requiresFollowUp?: boolean
  }
}

export type ConversationContext = {
  userId: string
  messages: AIMessage[]
  profile: ProfileData
  domain?: Domain
  language?: string
}
