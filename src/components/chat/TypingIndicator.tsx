'use client'

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-[var(--radius-bubble)] rounded-bl-md bg-bubble-assistant px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-on-surface-muted [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-on-surface-muted [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-on-surface-muted [animation-delay:300ms]" />
      </div>
    </div>
  )
}
