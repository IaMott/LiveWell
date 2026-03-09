'use client'

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react'
import type React from 'react'
import type { Domain } from '@/lib/ai/types'
import { LiveModal } from './live/LiveModal'

const DOMAIN_COLORS: Partial<Record<Domain, string>> = {
  nutrition: '#AF52DE',
  training: '#007AFF',
  health: '#34C759',
  mindfulness: '#5AC8FA',
  inspiration: '#FF9F0A',
}

// ── Icons from design/icons/ ──────────────────────────────────────────────────

type IconFC = (props: { color: string }) => React.ReactNode

function IconFood({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 800 800" width="18" height="18" fill={color} aria-hidden="true">
      <path d="M52.5,385.94l.78,24.22c1.72,52.89,20.47,104.37,54.37,148.75,32.5,42.58,77.81,77.5,131.17,101.02,11.88,5.23,25.7-.16,30.86-12.03,5.23-11.88-.16-25.7-12.03-30.86-46.09-20.31-85.08-50.23-112.81-86.56-22.66-29.69-37.11-63.05-42.5-97.66h595.78c-5.47,35-20.16,68.67-43.28,98.67-28.2,36.56-67.81,66.56-114.69,86.64-11.88,5.08-17.34,18.91-12.27,30.78,3.83,8.91,12.42,14.22,21.56,14.22,3.12,0,6.25-.62,9.22-1.88,112.89-48.59,185.16-144.77,188.52-251.09l.78-24.22H52.5Z"/>
      <path d="M518.19,619.08h-236.37c-52.33,0-95.29,22.5-95.29,50.08s42.81,50.08,95.29,50.08h236.37c52.33,0,95.29-22.5,95.29-50.08s-42.96-50.08-95.29-50.08ZM518.19,672.28h-236.37c-3.12,0-6.1-1.56-6.1-3.2s2.97-3.2,6.1-3.2h236.37c3.12,0,6.1,1.56,6.1,3.2s-2.97,3.2-6.1,3.2Z"/>
      <path d="M429.22,214.61c-36.48-35.63-84.14-55.31-134.22-55.31s-97.73,19.61-134.22,55.31c-36.02,35.23-57.81,82.81-61.41,133.91-.94,12.89,8.83,24.14,21.72,25s24.14-8.83,25-21.72c2.73-39.69,19.61-76.48,47.42-103.67,27.66-27.03,63.67-41.95,101.48-41.95s73.83,14.92,101.48,41.95c27.81,27.19,44.61,63.98,47.42,103.67.86,12.34,11.17,21.8,23.36,21.8.55,0,1.09,0,1.64-.08,12.89-.94,22.66-12.11,21.72-25-3.59-51.09-25.39-98.67-61.41-133.91Z"/>
      <path d="M389.14,291.8c-7.5-10.55-22.19-12.97-32.73-5.39-10.55,7.5-12.97,22.19-5.39,32.73,8.44,11.8,12.97,25.78,12.97,40.39,0,12.97,10.47,23.44,23.44,23.44s23.44-10.47,23.44-23.44c0-24.53-7.5-47.97-21.72-67.73Z"/>
      <path d="M699.3,301.48c-8.98-15.16-21.64-28.59-37.58-40l42.11-45.55c8.75-9.53,8.2-24.37-1.33-33.12s-24.38-8.2-33.13,1.33l-50.78,55c-3.91-1.41-7.89-2.73-11.95-3.91l64.38-124.37c5.94-11.48,1.48-25.63-10.08-31.56-11.48-5.94-25.62-1.48-31.56,10.08l-71.25,137.73c-4.3-.23-8.67-.39-13.05-.39-17.11,0-33.98,1.87-50.23,5.63-12.58,2.89-20.47,15.47-17.58,28.12,2.89,12.58,15.47,20.47,28.12,17.58,12.73-2.97,26.09-4.45,39.61-4.45,34.06,0,65.78,9.22,89.3,26.02,21.17,15.08,32.81,34.38,32.81,54.3,0,12.97,10.47,23.44,23.44,23.44s23.44-10.47,23.44-23.44c0-18.36-4.92-36.02-14.69-52.42Z"/>
    </svg>
  )
}

function IconGym({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 800 800" width="18" height="18" fill="none" stroke={color} strokeLinecap="round" strokeWidth="35.56" aria-hidden="true">
      <rect x="568.89" y="293.33" width="71.12" height="213.34" rx="17.78" />
      <rect x="497.78" y="222.22" width="71.12" height="355.56" rx="17.78" />
      <rect x="231.11" y="222.22" width="71.12" height="355.56" rx="17.78" />
      <rect x="160" y="293.33" width="71.12" height="213.34" rx="17.78" />
      <line x1="640" y1="400" x2="693.33" y2="400" />
      <line x1="320" y1="400" x2="497.78" y2="400" />
      <line x1="124.44" y1="400" x2="177.78" y2="400" />
    </svg>
  )
}

function IconHealth({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 800 800" width="18" height="18" fill="none" stroke={color} strokeWidth="20" strokeLinecap="round" aria-hidden="true">
      <path d="M616.67,300h-66.67M550,300h-66.67M550,300v-66.67M550,300v66.67" strokeLinejoin="round" />
      <path strokeMiterlimit="10" d="M91.67,310.58c0-96.82,42.26-156.67,94.53-177.14,52.16-20.43,125.15-5.85,195.54,69.44l36.52-34.15c-79.6-85.14-173.29-112-250.29-81.85-76.89,30.11-126.3,112.85-126.3,223.7h50ZM517.03,665.37c49.75-40.37,109.35-94.47,156.73-154.9,46.9-59.81,84.58-129.29,84.58-199.88h-50c0,53.71-29.31,112.13-73.92,169.03-44.13,56.29-100.56,107.71-148.89,146.93l31.51,38.82ZM758.33,310.58c0-110.85-49.41-193.59-126.3-223.7-77-30.15-170.69-3.29-250.29,81.85l36.52,34.15c70.39-75.29,143.38-89.86,195.54-69.44,52.28,20.47,94.53,80.32,94.53,177.14h50ZM282.97,665.37c42.38,34.39,71.77,59.63,117.03,59.63v-50c-24.1,0-39.1-10.79-85.52-48.46l-31.51,38.82ZM485.52,626.54c-46.42,37.67-61.43,48.46-85.52,48.46v50c45.26,0,74.65-25.24,117.03-59.63l-31.51-38.82ZM131.17,430.2c-24.9-41.17-39.5-81.7-39.5-119.61h-50c0,50.41,19.22,100.01,46.72,145.49l42.78-25.87ZM314.48,626.54c-30.57-24.81-64.51-54.6-96.57-87.52l-35.82,34.88c33.76,34.67,69.24,65.79,100.88,91.46l31.51-38.82Z" />
    </svg>
  )
}

function IconMental({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 800 800" width="18" height="18" fill={color} fillRule="evenodd" aria-hidden="true">
      <path d="M400.01,91.67c-32.22,0-58.33,26.12-58.33,58.33s26.12,58.33,58.33,58.33,58.33-26.12,58.33-58.33-26.12-58.33-58.33-58.33ZM291.67,150c0-59.83,48.5-108.33,108.33-108.33s108.33,48.5,108.33,108.33-48.5,108.33-108.33,108.33-108.33-48.5-108.33-108.33ZM428.96,327.4c-19.02-3.2-38.9-3.2-57.92,0-83.59,14.08-146.04,87.47-146.04,173.25,0,18.82-10.52,36.18-27.43,44.72l-86.3,43.61c-12.32,6.23-27.36,1.28-33.59-11.04-6.23-12.32-1.28-27.36,11.04-33.59l86.25-43.58s.03-.06.03-.12c0-110.18,80.06-204.42,187.74-222.56,24.52-4.13,50.01-4.13,74.53,0,107.67,18.14,187.74,112.38,187.74,222.56,0,.06,0,.09.02.12l86.25,43.58c12.32,6.23,17.27,21.26,11.04,33.59-6.23,12.32-21.27,17.27-33.59,11.04l-86.3-43.61c-16.91-8.54-27.43-25.9-27.43-44.72,0-85.78-62.45-159.17-146.04-173.25ZM331.67,513.33c11.04,8.28,13.28,23.95,5,35l-34.88,46.5c-.91,1.21-1.62,2.17-2.36,3.1-12.06,15.24-28.65,26.26-47.37,31.45-1.15.32-2.3.61-3.77.98l-.25.06-49.49,12.37c-23.63,5.91-40.2,27.14-40.2,51.49,0,7.75,6.29,14.04,14.04,14.04h51.87c20.55,0,28.83-.04,36.74-.97,19.27-2.26,37.87-8.46,54.65-18.22,6.88-4,13.54-8.94,29.97-21.27l6.06-4.55,66.67-50c11.04-8.28,26.71-6.05,35,5,8.28,11.05,6.04,26.72-5,35l-30.16,22.62,41.92,15.72c20.89,7.83,29.32,10.94,37.88,12.95,4.62,1.08,9.28,1.93,13.99,2.54,8.72,1.13,17.71,1.18,40.02,1.18h75.64c7.75,0,14.04-6.29,14.04-14.04,0-24.35-16.58-45.58-40.21-51.49l-49.75-12.44c-1.47-.37-2.62-.65-3.76-.97-18.72-5.2-35.31-16.21-47.37-31.45-.74-.93-1.46-1.89-2.36-3.1l-.15-.2-34.72-46.3c-8.29-11.05-6.05-26.72,5-35,11.04-8.28,26.71-6.05,35,5l34.72,46.3c1.13,1.51,1.44,1.92,1.73,2.28,5.48,6.93,13.02,11.93,21.53,14.3.44.12.94.25,2.77.71l49.49,12.37c45.89,11.47,78.08,52.7,78.08,100,0,35.37-28.67,64.04-64.04,64.04h-77.36c-20.06,0-32.42,0-44.73-1.6-6.36-.83-12.68-1.97-18.93-3.43-12.09-2.82-23.66-7.17-42.45-14.21l-73.45-27.54c-12.68,9.5-21.05,15.65-29.95,20.83-22.7,13.19-47.86,21.58-73.94,24.65-11.16,1.31-22.52,1.31-40.97,1.31h-53.48c-35.37,0-64.04-28.67-64.04-64.04,0-47.3,32.19-88.53,78.08-100l49.49-12.37c1.84-.46,2.33-.58,2.78-.71,8.51-2.36,16.05-7.37,21.53-14.3.29-.36.59-.77,1.73-2.28l34.72-46.3c8.28-11.05,23.95-13.28,35-5Z" />
    </svg>
  )
}

function IconIdea({ color }: { color: string }) {
  return (
    <svg viewBox="-4 0 19 19" width="18" height="18" fill={color} aria-hidden="true">
      <path d="M10.328 6.83a5.903 5.903 0 0 1-1.439 3.64 2.874 2.874 0 0 0-.584 1v1.037a.95.95 0 0 1-.95.95h-3.71a.95.95 0 0 1-.95-.95V11.47a2.876 2.876 0 0 0-.584-1A5.903 5.903 0 0 1 .67 6.83a4.83 4.83 0 0 1 9.28-1.878 4.796 4.796 0 0 1 .38 1.88zm-.95 0a3.878 3.878 0 0 0-7.756 0c0 2.363 2.023 3.409 2.023 4.64v1.037h3.71V11.47c0-1.231 2.023-2.277 2.023-4.64zM7.83 14.572a.475.475 0 0 1-.475.476h-3.71a.475.475 0 0 1 0-.95h3.71a.475.475 0 0 1 .475.474zm-.64 1.262a.238.238 0 0 1-.078.265 2.669 2.669 0 0 1-3.274 0 .237.237 0 0 1 .145-.425h2.983a.238.238 0 0 1 .225.16z" />
    </svg>
  )
}

function IconCronology({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={color} aria-hidden="true">
      <path d="M12,6a1,1,0,0,0-1,1v5a1,1,0,0,0,.293.707l3,3a1,1,0,0,0,1.414-1.414L13,11.586V7A1,1,0,0,0,12,6ZM23.812,10.132A12,12,0,0,0,3.578,3.415V1a1,1,0,0,0-2,0V5a2,2,0,0,0,2,2h4a1,1,0,0,0,0-2H4.827a9.99,9.99,0,1,1-2.835,7.878A.982.982,0,0,0,1,12a1.007,1.007,0,0,0-1,1.1,12,12,0,1,0,23.808-2.969Z" />
    </svg>
  )
}

// LIVE icon — matches design/icons/live.svg exactly
// active=true → red circle; active=false → gray circle
function IconLive({ active }: { active: boolean }) {
  const bg = active ? '#FF3B30' : '#dbdbda'
  return (
    <svg viewBox="0 0 800 800" width="30" height="30" aria-hidden="true">
      <circle cx="400" cy="400" r="354.33" fill={bg} />
      <path fillRule="evenodd" fill="#f7f7f8" d="M442.56,293.48c13.81,0,25,11.19,25,25v159.67c0,13.81-11.19,25-25,25s-25-11.19-25-25v-159.67c0-13.81,11.19-25,25-25h0Z"/>
      <path fillRule="evenodd" fill="#f7f7f8" d="M357.44,239.98c13.81,0,25,11.19,25,25v266.67c0,13.81-11.19,25-25,25s-25-11.19-25-25v-266.67c0-13.81,11.19-25,25-25h0Z"/>
      <path fillRule="evenodd" fill="#f7f7f8" d="M272.11,320.98c13.81,0,25,11.19,25,25v104.67c0,13.81-11.19,25-25,25s-25-11.19-25-25v-104.67c0-13.81,11.19-25,25-25h0Z"/>
      <path fillRule="evenodd" fill="#f7f7f8" d="M527.89,320.98c13.81,0,25,11.19,25,25v104.67c0,13.81-11.19,25-25,25s-25-11.19-25-25v-104.67c0-13.81,11.19-25,25-25h0Z"/>
    </svg>
  )
}

// ── Domain bar ────────────────────────────────────────────────────────────────

const DOMAINS: Array<{ domain: Domain; Icon: IconFC; label: string }> = [
  { domain: 'nutrition', Icon: IconFood, label: 'Nutrizione' },
  { domain: 'training', Icon: IconGym, label: 'Allenamento' },
  { domain: 'health', Icon: IconHealth, label: 'Salute' },
  { domain: 'mindfulness', Icon: IconMental, label: 'Mindfulness' },
  { domain: 'inspiration', Icon: IconIdea, label: 'Idee' },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onSend: (text: string, domain?: Domain) => void
  onHistory?: () => void
  disabled?: boolean
  activeDomain?: Domain | null
  onVoiceSend?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatInput({ onSend, onHistory, disabled, activeDomain, onVoiceSend }: Props) {
  const [text, setText] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(activeDomain ?? null)
  const [showLive, setShowLive] = useState(false)
  const [animDomain, setAnimDomain] = useState<Domain | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync activeDomain from orchestrator ui.state SSE
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (activeDomain && activeDomain !== selectedDomain) {
      setSelectedDomain(activeDomain) // eslint-disable-line react-hooks/set-state-in-effect
      setAnimDomain(activeDomain) // eslint-disable-line react-hooks/set-state-in-effect
      const t = setTimeout(() => setAnimDomain(null), 400)
      return () => clearTimeout(t)
    }
  }, [activeDomain]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentColor = selectedDomain ? (DOMAIN_COLORS[selectedDomain] ?? '#8E8E93') : '#8E8E93'

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    autoResize()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, selectedDomain ?? undefined)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleTranscription(transcript: string) {
    const trimmed = transcript.trim()
    if (!trimmed) return
    // Auto-send voice message immediately — no manual confirm needed
    onSend(trimmed, selectedDomain ?? undefined)
    // Signal parent to enable voice response (TTS)
    onVoiceSend?.()
  }

  return (
    <>
      {showLive && (
        <LiveModal
          onClose={() => setShowLive(false)}
          onTranscription={handleTranscription}
        />
      )}

      <div
        style={{
          padding: '0.5rem 0.75rem 0.75rem',
          backgroundColor: 'var(--color-bg, #F2F2F7)',
          borderTop: '1px solid var(--color-separator, #E5E5EA)',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-surface, #fff)',
            borderRadius: '1.25rem',
            padding: '0.625rem 0.75rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi al team…"
            rows={1}
            disabled={disabled}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              resize: 'none',
              fontSize: '1rem',
              lineHeight: 1.5,
              color: 'var(--color-text-primary, #1C1C1E)',
              fontFamily: 'inherit',
              overflowY: 'hidden',
              padding: 0,
              margin: 0,
              boxSizing: 'border-box',
            }}
          />

          {/* Bottom toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: '0.5rem',
              gap: '0',
            }}
          >
            {/* History */}
            <button
              type="button"
              aria-label="Cronologia"
              onClick={() => { setSelectedDomain(null); onHistory?.() }}
              style={iconBtnStyle(false)}
            >
              <IconCronology color={selectedDomain === null ? currentColor : 'var(--color-text-secondary, #8E8E93)'} />
            </button>

            {/* Separator */}
            <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--color-separator, #E5E5EA)', margin: '0 0.25rem' }} />

            {/* Domain icons */}
            {DOMAINS.map(({ domain, Icon, label }) => {
              const isActive = selectedDomain === domain
              const isAnimating = animDomain === domain
              const color = isActive ? (DOMAIN_COLORS[domain] ?? '#8E8E93') : 'var(--color-text-secondary, #8E8E93)'
              return (
                <button
                  key={domain}
                  type="button"
                  aria-label={label}
                  onClick={() => setSelectedDomain(isActive ? null : domain)}
                  className={isAnimating ? 'lw-domain-active' : undefined}
                  style={iconBtnStyle(isActive)}
                >
                  <Icon color={color} />
                </button>
              )
            })}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* LIVE button — icon matching design/icons/live.svg */}
            <button
              type="button"
              aria-label="Sessione live"
              onClick={() => setShowLive(true)}
              style={{
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                flexShrink: 0,
                marginRight: '0.375rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconLive active={showLive} />
            </button>

            {/* Send button */}
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || disabled}
              aria-label="Invia"
              style={{
                width: '2rem', height: '2rem', borderRadius: '50%', border: 'none',
                backgroundColor: text.trim() ? currentColor || '#007AFF' : 'var(--color-separator, #E5E5EA)',
                color: '#fff', cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.15s', flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function iconBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: '2rem', height: '2rem', borderRadius: '50%', border: 'none',
    backgroundColor: active ? 'var(--color-bg, #F2F2F7)' : 'transparent',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'background-color 0.15s',
  }
}

