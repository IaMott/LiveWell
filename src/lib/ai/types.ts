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
  birthDate?: Date | string | null
  gender?: string | null
  height?: number | null
  weight?: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  health?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nutrition?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  training?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mindfulness?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  goals?: any
}

/** Conversation context for the orchestrator */
export interface ConversationContext {
  messages: AIMessage[]
  domain?: Domain
  knownData: Record<string, string>
  missingData: string[]
  requiredData: string[]
  specialistMemory?: Record<string, string[]>
  riskSignal: 'none' | 'possible' | 'confirmed'
  userId: string
  profileData?: ProfileData
}

/** AI provider response (abstract — implemented by Gemini in STEP 8) */
export interface AIResponse {
  content: string
  specialist: SpecialistId
  contributors?: SpecialistId[]
  audit?: {
    riskLevel: RiskLevel
    pattern: string
    reasoning: string
  }
}
