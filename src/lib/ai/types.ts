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

/** Interview state machine */
export type InterviewState = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

/** Orchestrator routing decision */
export interface RoutingDecision {
  primarySpecialist: SpecialistId
  supportSpecialists: SpecialistId[]
  domain: Domain
  riskLevel: RiskLevel
  reasoning: string
  needsInterview: boolean
}

/** Message with context for AI processing */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: {
    type: 'image' | 'barcode'
    url: string
    fileName: string
    barcodeValue?: string
  }[]
}

/** Conversation context for the orchestrator */
export interface ConversationContext {
  messages: AIMessage[]
  domain?: Domain
  interviewState?: InterviewState
  knownData: Record<string, string>
  missingData: string[]
  riskSignal: 'none' | 'possible' | 'confirmed'
  userId: string
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
