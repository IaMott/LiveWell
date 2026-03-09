'use client'

import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react'
import type React from 'react'
import type { Domain } from '@/lib/ai/types'

const DOMAIN_COLORS: Partial<Record<Domain, string>> = {
  nutrition: '#AF52DE',
  training: '#007AFF',
  health: '#34C759',
  mindfulness: '#5AC8FA',
  inspiration: '#FF9F0A',
}

// Custom SVG icons from design/icons/ — inlined for zero dependency
function IconFood({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 800 800" width="18" height="18" fill={color} aria-hidden="true">
      <path d="M52.5,385.94l.78,24.22c1.72,52.89,20.47,104.37,54.37,148.75,32.5,42.58,77.81,77.5,131.17,101.02,11.88,5.23,25.7-.16,30.86-12.03,5.23-11.88-.16-25.7-12.03-30.86-46.09-20.31-85.08-50.23-112.81-86.56-22.66-29.69-37.11-63.05-42.5-97.66h595.78c-5.47,35-20.16,68.67-43.28,98.67-28.2,36.56-67.81,66.56-114.69,86.64-11.88,5.08-17.34,18.91-12.27,30.78,3.83,8.91,12.42,14.22,21.56,14.22,3.12,0,6.25-.62,9.22-1.88,112.89-48.59,185.16-144.77,188.52-251.09l.78-24.22H52.5Z"/>
      <path d="M518.19,619.08h-236.37c-52.33,0-95.29,22.5-95.29,50.08s42.81,50.08,95.29,50.08h236.37c52.33,0,95.29-22.5,95.29-50.08s-42.96-50.08-95.29-50.08ZM518.19,672.28h-236.37c-3.12,0-6.1-1.56-6.1-3.2s2.97-3.2,6.1-3.2h236.37c3.12,0,6.1,1.56,6.1,3.2s-2.97,3.2-6.1,3.2Z"/>
      <path d="M429.22,214.61c-36.48-35.63-84.14-55.31-134.22-55.31s-97.73,19.61-134.22,55.31c-36.02,35.23-57.81,82.81-61.41,133.91-.94,12.89,8.83,24.14,21.72,25s24.14-8.83,25-21.72c2.73-39.69,19.61-76.48,47.42-103.67,27.66-27.03,63.67-41.95,101.48-41.95s73.83,14.92,101.48,41.95c27.81,27.19,44.61,63.98,47.42,103.67.86,12.34,11.17,21.8,23.36,21.8.55,0,1.09,0,1.64-.08,12.89-.94,22.66-12.11,21.72-25-3.59-51.09-25.39-98.67-61.41-133.91Z"/>
    </svg>
  )
}

function IconGym({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 800 800" width="18" height="18" fill="none" stroke={color} strokeLinecap="round" strokeWidth="35.56" aria-hidden="true">
      <rect x="568.89" y="293.33" width="71.12" height="213.34" rx="17.78"/>
      <rect x="497.78" y="222.22" width="71.12" height="355.56" rx="17.78"/>
      <rect x="231.11" y="222.22" width="71.12" height="355.56" rx="17.78"/>
      <rect x="160" y="293.33" width="71.12" height="213.34" rx="17.78"/>
      <line x1="640" y1="400" x2="693.33" y2="400"/>
      <line x1="320" y1="400" x2="497.78" y2="400"/>
      <line x1="124.44" y1="400" x2="177.78" y2="400"/>
    </svg>
  )
}

function IconHealth({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 800 800" width="18" height="18" fill="none" stroke={color} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M616.67,300h-66.67M550,300h-66.67M550,300v-66.67M550,300v66.67"/>
      <path strokeMiterlimit="10" d="M298.72,645.95l15.75-19.41M400,185.8l-18.26,17.07c4.73,5.06,11.34,7.93,18.26,7.93s13.53-2.87,18.26-7.93l-18.26-17.07ZM501.28,645.96l15.75,19.41M91.67,310.58c0-96.82,42.26-156.67,94.53-177.14,52.16-20.43,125.15-5.85,195.54,69.44l36.52-34.15c-79.6-85.14-173.29-112-250.29-81.85-76.89,30.11-126.3,112.85-126.3,223.7h50ZM517.03,665.37c49.75-40.37,109.35-94.47,156.73-154.9,46.9-59.81,84.58-129.29,84.58-199.88h-50c0,53.71-29.31,112.13-73.92,169.03-44.13,56.29-100.56,107.71-148.89,146.93l31.51,38.82ZM758.33,310.58c0-110.85-49.41-193.59-126.3-223.7-77-30.15-170.69-3.29-250.29,81.85l36.52,34.15c70.39-75.29,143.38-89.86,195.54-69.44,52.28,20.47,94.53,80.32,94.53,177.14h50ZM282.97,665.37c42.38,34.39,71.77,59.63,117.03,59.63v-50c-24.1,0-39.1-10.79-85.52-48.46l-31.51,38.82ZM485.52,626.54c-46.42,37.67-61.43,48.46-85.52,48.46v50c45.26,0,74.65-25.24,117.03-59.63l-31.51-38.82ZM131.17,430.2c-24.9-41.17-39.5-81.7-39.5-119.61h-50c0,50.41,19.22,100.01,46.72,145.49l42.78-25.87ZM314.48,626.54c-30.57-24.81-64.51-54.6-96.57-87.52l-35.82,34.88c33.76,34.67,69.24,65.79,100.88,91.46l31.51-38.82Z"/>
    </svg>
  )
}

function IconMental({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 800 800" width="18" height="18" fill={color} fillRule="evenodd" aria-hidden="true">
      <path d="M400.01,91.67c-32.22,0-58.33,26.12-58.33,58.33s26.12,58.33,58.33,58.33,58.33-26.12,58.33-58.33-26.12-58.33-58.33-58.33ZM291.67,150c0-59.83,48.5-108.33,108.33-108.33s108.33,48.5,108.33,108.33-48.5,108.33-108.33,108.33-108.33-48.5-108.33-108.33ZM428.96,327.4c-19.02-3.2-38.9-3.2-57.92,0-83.59,14.08-146.04,87.47-146.04,173.25,0,18.82-10.52,36.18-27.43,44.72l-86.3,43.61c-12.32,6.23-27.36,1.28-33.59-11.04-6.23-12.32-1.28-27.36,11.04-33.59l86.25-43.58s.03-.06.03-.12c0-110.18,80.06-204.42,187.74-222.56,24.52-4.13,50.01-4.13,74.53,0,107.67,18.14,187.74,112.38,187.74,222.56,0,.06,0,.09.02.12l86.25,43.58c12.32,6.23,17.27,21.26,11.04,33.59-6.23,12.32-21.27,17.27-33.59,11.04l-86.3-43.61c-16.91-8.54-27.43-25.9-27.43-44.72,0-85.78-62.45-159.17-146.04-173.25Z"/>
    </svg>
  )
}

function IconIdea({ color }: { color: string }) {
  return (
    <svg viewBox="-4 0 19 19" width="18" height="18" fill={color} aria-hidden="true">
      <path d="M10.328 6.83a5.903 5.903 0 0 1-1.439 3.64 2.874 2.874 0 0 0-.584 1v1.037a.95.95 0 0 1-.95.95h-3.71a.95.95 0 0 1-.95-.95V11.47a2.876 2.876 0 0 0-.584-1A5.903 5.903 0 0 1 .67 6.83a4.83 4.83 0 0 1 9.28-1.878 4.796 4.796 0 0 1 .38 1.88zm-.95 0a3.878 3.878 0 0 0-7.756 0c0 2.363 2.023 3.409 2.023 4.64v1.037h3.71V11.47c0-1.231 2.023-2.277 2.023-4.64zM7.83 14.572a.475.475 0 0 1-.475.476h-3.71a.475.475 0 0 1 0-.95h3.71a.475.475 0 0 1 .475.474zm-.64 1.262a.238.238 0 0 1-.078.265 2.669 2.669 0 0 1-3.274 0 .237.237 0 0 1 .145-.425h2.983a.238.238 0 0 1 .225.16z"/>
    </svg>
  )
}

function IconCronology({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={color} aria-hidden="true">
      <path d="M12,6a1,1,0,0,0-1,1v5a1,1,0,0,0,.293.707l3,3a1,1,0,0,0,1.414-1.414L13,11.586V7A1,1,0,0,0,12,6ZM23.812,10.132A12,12,0,0,0,3.578,3.415V1a1,1,0,0,0-2,0V5a2,2,0,0,0,2,2h4a1,1,0,0,0,0-2H4.827a9.99,9.99,0,1,1-2.835,7.878A.982.982,0,0,0,1,12a1.007,1.007,0,0,0-1,1.1,12,12,0,1,0,23.808-2.969Z"/>
    </svg>
  )
}

function IconLive({ active }: { active: boolean }) {
  const barColor = active ? '#fff' : 'currentColor'
  return (
    <svg viewBox="0 0 800 800" width="16" height="16" fill={barColor} aria-hidden="true">
      <rect x="417.56" y="293.48" width="50" height="209.67" rx="25"/>
      <rect x="332.44" y="239.98" width="50" height="316.67" rx="25"/>
      <rect x="247.11" y="320.98" width="50" height="154.67" rx="25"/>
      <rect x="502.89" y="320.98" width="50" height="154.67" rx="25"/>
    </svg>
  )
}

type IconFC = (props: { color: string }) => React.ReactNode

const DOMAINS: Array<{ domain: Domain; Icon: IconFC; label: string }> = [
  { domain: 'nutrition', Icon: IconFood, label: 'Nutrizione' },
  { domain: 'training', Icon: IconGym, label: 'Allenamento' },
  { domain: 'health', Icon: IconHealth, label: 'Salute' },
  { domain: 'mindfulness', Icon: IconMental, label: 'Mindfulness' },
  { domain: 'inspiration', Icon: IconIdea, label: 'Idee' },
]

type Props = {
  onSend: (message: string) => void
  onHistory?: () => void
  onLive?: () => void
  disabled?: boolean
}

export function ChatInput({ onSend, onHistory, onLive, disabled = false }: Props) {
  const [text, setText] = useState('')
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function toggleDomain(domain: Domain) {
    setActiveDomain((prev) => (prev === domain ? null : domain))
  }

  const canSend = text.trim().length > 0 && !disabled

  return (
    <div style={{ padding: '0.5rem 0.75rem 1.5rem' }}>
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '1.25rem',
          border: '1px solid var(--color-separator)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          padding: '0.75rem 0.875rem 0.5rem',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Scrivi al team…"
          rows={1}
          disabled={disabled}
          aria-label="Messaggio"
          style={{
            width: '100%',
            resize: 'none',
            outline: 'none',
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '0.375rem',
            gap: '0.125rem',
          }}
        >
          {/* History */}
          <button
            type="button"
            aria-label="Storico conversazioni"
            onClick={onHistory}
            style={iconBtnStyle}
          >
            <IconCronology color="var(--color-text-secondary)" />
          </button>

          {/* Separator */}
          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-separator)', margin: '0 0.25rem' }} />

          {/* Domain icons */}
          {DOMAINS.map(({ domain, Icon, label }) => {
            const isActive = activeDomain === domain
            const color = DOMAIN_COLORS[domain] ?? 'var(--color-text-secondary)'
            return (
              <button
                key={domain}
                type="button"
                aria-label={label}
                onClick={() => toggleDomain(domain)}
                style={{
                  ...iconBtnStyle,
                  backgroundColor: isActive ? `${color}18` : 'transparent',
                  color: isActive ? color : 'var(--color-text-secondary)',
                  transition: 'color 0.15s, background-color 0.15s',
                }}
              >
                <Icon color={isActive ? color : 'var(--color-text-secondary)'} />
              </button>
            )
          })}

          {/* Right side actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            {/* LIVE button */}
            <button
              type="button"
              aria-label="Sessione Live"
              onClick={onLive}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.625rem',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: '#FF3B30',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              <IconLive active />
              <span>LIVE</span>
            </button>

            {/* Send */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Invia messaggio"
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: canSend ? 'var(--color-text-primary)' : 'var(--color-separator)',
                cursor: canSend ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s',
              }}
            >
              <SendArrow active={canSend} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SendArrow({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1L7 13M7 1L2 6M7 1L12 6"
        stroke={active ? '#fff' : 'var(--color-text-secondary)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const iconBtnStyle: React.CSSProperties = {
  padding: '0.375rem',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
}
