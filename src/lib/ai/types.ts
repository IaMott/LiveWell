/** Risk levels for the orchestrator triage */
export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3'

/** Specialist identifier */
export type SpecialistId =
  | 'orchestratore'
  | 'intervistatore'
  | 'dietista'
  | 'personal_trainer'
  | 'psicologo'
  | 'mental_coach'
  | 'chef'
  | 'fisioterapista'
  | 'fisiatra'
  | 'medico_sport'
  | 'mmg'
  | 'gastroenterologo'
  | 'chinesologo'
  | 'analista_contesto'

/** Domain categories for routing */
export type Domain =
  | 'nutrizione'
  | 'allenamento'
  | 'mindset'
  | 'cucina'
  | 'salute'
  | 'riabilitazione'
  | 'generale'

/** Orchestrator routing decision */
export interface RoutingDecision {
  primarySpecialist: SpecialistId
  supportSpecialists: SpecialistId[]
  domain: Domain
  riskLevel: RiskLevel
  reasoning: string
}

/** Message with context for AI processing */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: {
    type: 'image' | 'barcode' | 'audio'
    url: string
    fileName: string
    barcodeValue?: string
  }[]
}

/** User profile data from database */
export interface ProfileData {
  birthDate?: string | null
  gender?: string | null
  height?: number | null
  weight?: number | null
  health?: Record<string, unknown> | null
  nutrition?: Record<string, unknown> | null
  training?: Record<string, unknown> | null
  mindfulness?: Record<string, unknown> | null
  goals?: Record<string, unknown> | null
}

/** Conversation context for the orchestrator */
export interface ConversationContext {
  messages: AIMessage[]
  domain?: Domain
  knownData: Record<string, string>
  missingData: string[]
  riskSignal: 'none' | 'possible' | 'confirmed'
  userId: string
  profileData?: ProfileData
}

/** AI provider response (abstract — implemented by Gemini in STEP 8) */
export interface AIResponse {
  content: string
  specialist: SpecialistId
  audit?: {
    riskLevel: RiskLevel
    pattern: string
    reasoning: string
  }
}
