'use client'

import { useState } from 'react'

export function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = content
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      className="ml-auto rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
      title="Copia contenuto"
      onClick={handleCopy}
    >
      {copied ? '✓ Copiato' : 'Copia'}
    </button>
  )
}
