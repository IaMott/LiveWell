const INTERNAL_TOOL_LINE_REGEX =
  /^\s*(?:Payload:\s*)?(?:(?:user\.(?:setAttribute|updateProfile))|(?:health|nutrition|training|mindfulness|general|coordination|artifacts)\.[A-Za-z0-9_.-]+)\b/i

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n/g, '\n')
}

export function sanitizeAssistantVisibleContent(content: string): string {
  const normalized = normalizeNewlines(content)
  const keptLines = normalized
    .split('\n')
    .filter((line) => !INTERNAL_TOOL_LINE_REGEX.test(line.trim()))

  return keptLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function hasVisibleAssistantContent(content: string): boolean {
  return sanitizeAssistantVisibleContent(content).length > 0
}
